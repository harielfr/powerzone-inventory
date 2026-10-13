/* Testes de caracterização dos handlers postEditStatusCancelled, postEditStatusCompleted e
 * postEditStatusPending de controllers/transaction-controller.js.
 *
 * Fixam o comportamento observável atual (estado final do estoque FIFO, status da transação e da
 * entrega, resposta HTTP) para servir de rede de segurança durante a refatoração. Não fixam
 * quantas gravações são feitas nem em que ordem. O módulo db é simulado com sinon; os stubs
 * chamam os callbacks de forma síncrona, então todo o fluxo termina antes de o handler retornar.
 */
const expect = require('chai').expect;
const sinon = require('sinon');

const transactionController = require('../controllers/transaction-controller.js');
const Transaction = require('../models/transaction-schema.js');
const Inventory = require('../models/inventory-schema.js');
const Delivery = require('../models/delivery-schema.js');
const db = require('../models/db.js');

const TRANSACTION_ID = '10000123';
const DELIVERY_ID = 20000123;

/* Lotes de estoque, propositalmente fora de ordem cronológica para exercitar a ordenação. */
function buildStocks() {
	return [
		{_id: 'g-new', type: 'gasoline', date: new Date('2022-03-01'), quantityPurchased: 100, quantityDepleted: 30},
		{_id: 'd-new', type: 'diesel', date: new Date('2022-02-10'), quantityPurchased: 200, quantityDepleted: 20},
		{_id: 'g-old', type: 'gasoline', date: new Date('2022-01-01'), quantityPurchased: 100, quantityDepleted: 100},
		{_id: 'p95-b', type: 'premium-gasoline-95', date: new Date('2022-01-20'), quantityPurchased: 50, quantityDepleted: 10},
		{_id: 'k-new', type: 'kerosene', date: new Date('2022-02-15'), quantityPurchased: 100, quantityDepleted: 50},
		{_id: 'g-mid', type: 'gasoline', date: new Date('2022-02-01'), quantityPurchased: 100, quantityDepleted: 60},
		{_id: 'p97', type: 'premium-gasoline-97', date: new Date('2022-01-15'), quantityPurchased: 100, quantityDepleted: 40},
		{_id: 'd-old', type: 'diesel', date: new Date('2022-01-10'), quantityPurchased: 200, quantityDepleted: 150},
		{_id: 'p95-a', type: 'premium-gasoline-95', date: new Date('2022-01-05'), quantityPurchased: 50, quantityDepleted: 50},
		{_id: 'k-old', type: 'kerosene', date: new Date('2022-01-02'), quantityPurchased: 100, quantityDepleted: 100}
	];
}

/* Depleção de cada lote antes de qualquer gravação. */
function initialDepletion(stockList) {
	const depletion = {};
	stockList.forEach(function(stock) {
		depletion[stock._id] = stock.quantityDepleted;
	});
	return depletion;
}

const INITIAL_DEPLETION = initialDepletion(buildStocks());

/* Transação cujo cancelamento devolve estoque a partir do lote mais recente. */
const TRANSACTION_TO_RETURN = {
	id: TRANSACTION_ID,
	litersGasoline: 50,
	litersPremiumGasoline95: 5,
	litersDiesel: 30,
	litersPremiumGasoline97: 0,
	litersKerosene: 70
};

/* Depleção esperada após devolver TRANSACTION_TO_RETURN. */
const EXPECTED_AFTER_RETURN = {
	'g-old': 100, // intocado
	'g-mid': 40, // 60 - 20
	'g-new': 0, // 30 - 30 (lote mais recente esvaziado primeiro)
	'p95-a': 50, // intocado
	'p95-b': 5, // 10 - 5
	'd-old': 140, // 150 - 10
	'd-new': 0, // 20 - 20
	'p97': 40, // tipo sem litros na transação
	'k-old': 80, // 100 - 20
	'k-new': 0 // 50 - 50
};

/* Transação cuja reativação consome estoque a partir do lote mais antigo. */
const TRANSACTION_TO_CONSUME = {
	id: TRANSACTION_ID,
	litersGasoline: 80,
	litersPremiumGasoline95: 40,
	litersDiesel: 60,
	litersPremiumGasoline97: 0,
	litersKerosene: 30
};

/* Depleção esperada após consumir TRANSACTION_TO_CONSUME. */
const EXPECTED_AFTER_CONSUME = {
	'g-old': 100, // já esgotado (0 disponível)
	'g-mid': 100, // 60 + 40
	'g-new': 70, // 30 + 40
	'p95-a': 50, // já esgotado
	'p95-b': 50, // 10 + 40
	'd-old': 200, // 150 + 50
	'd-new': 30, // 20 + 10
	'p97': 40, // tipo sem litros na transação
	'k-old': 100, // já esgotado
	'k-new': 80 // 50 + 30
};

function transactionWith(liters) {
	return Object.assign({
		id: TRANSACTION_ID,
		litersGasoline: 0,
		litersPremiumGasoline95: 0,
		litersDiesel: 0,
		litersPremiumGasoline97: 0,
		litersKerosene: 0
	}, liters);
}

describe('caracterização da edição de status da transação', function() {
	let res;
	let transaction;
	let stocks;
	let initial;

	/* Estado final de cada lote: estado inicial sobreposto pelas gravações feitas. */
	function finalDepletion() {
		const depletion = Object.assign({}, initial);
		db.updateOneIterative.getCalls().forEach(function(call) {
			expect(call.args[0]).to.equal(Inventory);
			depletion[call.args[1]._id] = call.args[2].quantityDepleted;
		});
		return depletion;
	}

	function request(transactionStatusOld) {
		return {
			body: {
				transactionId: TRANSACTION_ID,
				transactionStatusOld: transactionStatusOld
			}
		};
	}

	function expectTransactionAndDeliveryUpdated(newStatus) {
		expect(db.updateOne.calledWith(Transaction, {id: TRANSACTION_ID}, {status: newStatus})).to.be.true;
		expect(db.updateOne.calledWith(Delivery, {id: DELIVERY_ID}, {status: newStatus})).to.be.true;
	}

	function expectSuccessResponse() {
		expect(res.status.calledOnceWith(200)).to.be.true;
		expect(res.json.calledOnceWith('Delivery status updated successfully!')).to.be.true;
		expect(res.send.calledOnce).to.be.true;
	}

	function expectNoStockChange() {
		expect(db.findMany.calledWith(Inventory)).to.be.false;
		expect(finalDepletion()).to.deep.equal(INITIAL_DEPLETION);
	}

	function useStocks(stockList) {
		stocks = stockList;
		initial = initialDepletion(stockList);
	}

	beforeEach(async function() {
		res = {
			status: sinon.stub().returnsThis(),
			json: sinon.stub(),
			send: sinon.stub()
		};
		useStocks(buildStocks());

		sinon.stub(db, 'updateOne').callsFake(function(model, filter, update, callback) {
			callback(true);
		});
		sinon.stub(db, 'findOne').callsFake(function(model, query, projection, callback) {
			callback(transaction);
		});
		sinon.stub(db, 'findMany').callsFake(function(model, query, projection, callback) {
			callback(stocks);
		});
		sinon.stub(db, 'updateOneIterative');
	});

	afterEach(function() {
		sinon.restore();
	});

	describe('postEditStatusCancelled', function() {
		['pending', 'completed'].forEach(function(oldStatus) {
			describe(oldStatus + ' -> cancelled', function() {
				beforeEach(async function() {
					transaction = Object.assign({}, TRANSACTION_TO_RETURN);
					await transactionController.postEditStatusCancelled(request(oldStatus), res);
				});

				it('devolve o estoque (FIFO) a partir do lote mais recente, para cada tipo de combustível', async function() {
					expect(finalDepletion()).to.deep.equal(EXPECTED_AFTER_RETURN);
				});

				it('atualiza a transação e a entrega (id + 10000000) para cancelled', async function() {
					expectTransactionAndDeliveryUpdated('cancelled');
				});

				it('responde 200', async function() {
					expectSuccessResponse();
				});
			});
		});

		it('pending -> cancelled devolve a um único lote parcialmente, sem tocar nos anteriores', async function() {
			transaction = transactionWith({litersGasoline: 10});

			await transactionController.postEditStatusCancelled(request('pending'), res);

			const depletion = finalDepletion();
			expect(depletion['g-new']).to.equal(20);
			expect(depletion['g-mid']).to.equal(60);
			expect(depletion['g-old']).to.equal(100);
			expectSuccessResponse();
		});

		it('cancelled -> cancelled não altera o estoque, mas atualiza a entrega e responde 200', async function() {
			await transactionController.postEditStatusCancelled(request('cancelled'), res);

			expectNoStockChange();
			expectTransactionAndDeliveryUpdated('cancelled');
			expectSuccessResponse();
		});
	});

	[
		{handler: 'postEditStatusCompleted', newStatus: 'completed', noEffect: ['pending', 'completed']},
		{handler: 'postEditStatusPending', newStatus: 'pending', noEffect: ['completed', 'pending']}
	].forEach(function(scenario) {
		describe(scenario.handler, function() {
			describe('cancelled -> ' + scenario.newStatus, function() {
				beforeEach(async function() {
					transaction = Object.assign({}, TRANSACTION_TO_CONSUME);
					await transactionController[scenario.handler](request('cancelled'), res);
				});

				it('consome o estoque (FIFO) a partir do lote mais antigo, para cada tipo de combustível', async function() {
					expect(finalDepletion()).to.deep.equal(EXPECTED_AFTER_CONSUME);
				});

				it('atualiza a transação e a entrega (id + 10000000) para ' + scenario.newStatus, async function() {
					expectTransactionAndDeliveryUpdated(scenario.newStatus);
				});

				it('responde 200', async function() {
					expectSuccessResponse();
				});
			});

			it('cancelled -> ' + scenario.newStatus + ' consome parcialmente o lote mais antigo com saldo', async function() {
				transaction = transactionWith({litersDiesel: 25});

				await transactionController[scenario.handler](request('cancelled'), res);

				const depletion = finalDepletion();
				expect(depletion['d-old']).to.equal(175);
				expect(depletion['d-new']).to.equal(20);
				expectSuccessResponse();
			});

			scenario.noEffect.forEach(function(oldStatus) {
				it(oldStatus + ' -> ' + scenario.newStatus + ' não altera o estoque, mas atualiza a entrega e responde 200', async function() {
					await transactionController[scenario.handler](request(oldStatus), res);

					expectNoStockChange();
					expectTransactionAndDeliveryUpdated(scenario.newStatus);
					expectSuccessResponse();
				});
			});
		});
	});

	describe('lote de tipo desconhecido', function() {
		it('é tratado como kerosene: cancelled -> pending consome dele primeiro por ser o mais antigo', async function() {
			useStocks(buildStocks().concat([
				{_id: 'unknown', type: 'biodiesel', date: new Date('2021-12-01'), quantityPurchased: 100, quantityDepleted: 90}
			]));
			transaction = transactionWith({litersKerosene: 30});

			await transactionController.postEditStatusPending(request('cancelled'), res);

			const depletion = finalDepletion();
			expect(depletion['unknown']).to.equal(100); // 90 + 10
			expect(depletion['k-old']).to.equal(100); // já esgotado
			expect(depletion['k-new']).to.equal(70); // 50 + 20
			expectTransactionAndDeliveryUpdated('pending');
			expectSuccessResponse();
		});
	});

	describe('transactionStatusOld indefinido', function() {
		[
			{handler: 'postEditStatusCancelled', newStatus: 'cancelled'},
			{handler: 'postEditStatusCompleted', newStatus: 'completed'},
			{handler: 'postEditStatusPending', newStatus: 'pending'}
		].forEach(function(scenario) {
			it(scenario.handler + ' não altera o estoque, mas atualiza a entrega e responde 200', async function() {
				transaction = Object.assign({}, TRANSACTION_TO_CONSUME);

				await transactionController[scenario.handler](request(undefined), res);

				expectNoStockChange();
				expectTransactionAndDeliveryUpdated(scenario.newStatus);
				expectSuccessResponse();
			});
		});
	});
});
