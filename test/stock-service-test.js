const expect = require('chai').expect;
const sinon = require('sinon');

const StockService = require('../services/stock-service.js');
const transactionController = require('../controllers/transaction-controller.js');
const db = require('../models/db.js');

/* Mesma fixture de test/transaction-status-characterization-test.js: lotes fora de ordem. */
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

const TRANSACTION_TO_RETURN = {
	litersGasoline: 50,
	litersPremiumGasoline95: 5,
	litersDiesel: 30,
	litersPremiumGasoline97: 0,
	litersKerosene: 70
};

const EXPECTED_AFTER_RETURN = {
	'g-old': 100, 'g-mid': 40, 'g-new': 0,
	'p95-a': 50, 'p95-b': 5,
	'd-old': 140, 'd-new': 0,
	'p97': 40,
	'k-old': 80, 'k-new': 0
};

const TRANSACTION_TO_CONSUME = {
	litersGasoline: 80,
	litersPremiumGasoline95: 40,
	litersDiesel: 60,
	litersPremiumGasoline97: 0,
	litersKerosene: 30
};

const EXPECTED_AFTER_CONSUME = {
	'g-old': 100, 'g-mid': 100, 'g-new': 70,
	'p95-a': 50, 'p95-b': 50,
	'd-old': 200, 'd-new': 30,
	'p97': 40,
	'k-old': 100, 'k-new': 80
};

function fakeRepo(stocks) {
	return {
		findAll: sinon.stub().resolves(stocks),
		saveDepleted: sinon.stub()
	};
}

/* Depleção de cada lote gravado, por _id. */
function savedDepletion(repo) {
	expect(repo.saveDepleted.calledOnce).to.be.true;
	const depletion = {};
	repo.saveDepleted.firstCall.args[0].forEach(function(stock) {
		depletion[stock._id] = stock.quantityDepleted;
	});
	return depletion;
}

describe('StockService.adjust (services/stock-service.js)', function() {
	describe('transições sem efeito no estoque', function() {
		const STATUSES = ['pending', 'completed', 'cancelled'];
		const NO_EFFECT = [];
		['pending', 'completed', 'cancelled', undefined, 'delivered'].forEach(function(oldStatus) {
			STATUSES.forEach(function(newStatus) {
				const returns = (oldStatus === 'pending' || oldStatus === 'completed') && newStatus === 'cancelled';
				const consumes = oldStatus === 'cancelled' && newStatus !== 'cancelled';
				if (!returns && !consumes) {
					NO_EFFECT.push([oldStatus, newStatus]);
				}
			});
		});

		NO_EFFECT.forEach(function(transition) {
			it(String(transition[0]) + ' -> ' + transition[1] + ' não lê nem grava o inventário', async function() {
				const repo = fakeRepo(buildStocks());

				await StockService.adjust({
					transaction: TRANSACTION_TO_CONSUME,
					oldStatus: transition[0],
					newStatus: transition[1]
				}, repo);

				expect(repo.findAll.called).to.be.false;
				expect(repo.saveDepleted.called).to.be.false;
			});
		});
	});

	['pending', 'completed'].forEach(function(oldStatus) {
		it(oldStatus + ' -> cancelled devolve o estoque a partir do lote mais recente, em todos os combustíveis', async function() {
			const repo = fakeRepo(buildStocks());

			await StockService.adjust({transaction: TRANSACTION_TO_RETURN, oldStatus: oldStatus, newStatus: 'cancelled'}, repo);

			expect(repo.findAll.calledOnce).to.be.true;
			expect(savedDepletion(repo)).to.deep.equal(EXPECTED_AFTER_RETURN);
		});
	});

	['pending', 'completed'].forEach(function(newStatus) {
		it('cancelled -> ' + newStatus + ' consome o estoque a partir do lote mais antigo, em todos os combustíveis', async function() {
			const repo = fakeRepo(buildStocks());

			await StockService.adjust({transaction: TRANSACTION_TO_CONSUME, oldStatus: 'cancelled', newStatus: newStatus}, repo);

			expect(repo.findAll.calledOnce).to.be.true;
			expect(savedDepletion(repo)).to.deep.equal(EXPECTED_AFTER_CONSUME);
		});
	});

	it('grava todos os lotes lidos (inclusive os inalterados), uma única vez, com as mesmas referências', async function() {
		const stocks = buildStocks();
		const repo = fakeRepo(stocks);

		await StockService.adjust({transaction: {litersDiesel: 25}, oldStatus: 'cancelled', newStatus: 'pending'}, repo);

		const saved = repo.saveDepleted.firstCall.args[0];
		expect(saved).to.have.lengthOf(stocks.length);
		expect(saved).to.have.members(stocks);
		expect(savedDepletion(repo)['d-old']).to.equal(175);
		expect(savedDepletion(repo)['d-new']).to.equal(20);
	});

	it('trata lote de tipo desconhecido como kerosene', async function() {
		const repo = fakeRepo(buildStocks().concat([
			{_id: 'unknown', type: 'biodiesel', date: new Date('2021-12-01'), quantityPurchased: 100, quantityDepleted: 90}
		]));

		await StockService.adjust({transaction: {litersKerosene: 30}, oldStatus: 'cancelled', newStatus: 'pending'}, repo);

		const depletion = savedDepletion(repo);
		expect(depletion['unknown']).to.equal(100);
		expect(depletion['k-old']).to.equal(100);
		expect(depletion['k-new']).to.equal(70);
	});

	it('não aguarda a gravação (dispara-e-esquece)', async function() {
		const repo = fakeRepo(buildStocks());
		repo.saveDepleted.returns(new Promise(function() {})); // nunca resolve

		await StockService.adjust({transaction: TRANSACTION_TO_RETURN, oldStatus: 'pending', newStatus: 'cancelled'}, repo);

		expect(repo.saveDepleted.calledOnce).to.be.true;
	});

	it('propaga a falha de leitura do inventário sem gravar nada', async function() {
		const repo = {findAll: sinon.stub().rejects(new Error('falha')), saveDepleted: sinon.stub()};
		let error;

		try {
			await StockService.adjust({transaction: TRANSACTION_TO_RETURN, oldStatus: 'pending', newStatus: 'cancelled'}, repo);
		} catch (e) {
			error = e;
		}

		expect(error).to.be.an('error').with.property('message', 'falha');
		expect(repo.saveDepleted.called).to.be.false;
	});

	/* Equivalência ponta a ponta: o mesmo cenário rodado no handler (com db simulado) e no
	 * StockService deve deixar o estoque igual. Hoje compara com o código original; depois que os
	 * handlers usarem o StockService, vira um teste de integração. Transações geradas com semente fixa.
	 */
	describe('equivalência com os handlers de controllers/transaction-controller.js', function() {
		const HANDLERS = {cancelled: 'postEditStatusCancelled', completed: 'postEditStatusCompleted', pending: 'postEditStatusPending'};
		const FIELDS = ['litersGasoline', 'litersPremiumGasoline95', 'litersDiesel', 'litersPremiumGasoline97', 'litersKerosene'];
		/* Limites que cabem na fixture para consumo e devolução (evita o TypeError herdado). */
		const LIMITS = {
			consume: {litersGasoline: 110, litersPremiumGasoline95: 40, litersDiesel: 230, litersPremiumGasoline97: 60, litersKerosene: 50},
			return: {litersGasoline: 190, litersPremiumGasoline95: 60, litersDiesel: 170, litersPremiumGasoline97: 40, litersKerosene: 150}
		};

		let seed = 12345;
		function random() {
			seed = (seed * 1103515245 + 12345) % 2147483648;
			return seed / 2147483648;
		}

		function randomTransaction(limits) {
			const transaction = {id: '10000123'};
			FIELDS.forEach(function(field) {
				transaction[field] = random() < 0.3 ? 0 : Math.floor(random() * (limits[field] + 1));
			});
			return transaction;
		}

		/* Roda o handler com db simulado e espera a resposta (res.send), o que funciona tanto com o
		 * handler síncrono original quanto com uma versão assíncrona que use o StockService.
		 */
		async function handlerDepletion(transaction, oldStatus, newStatus) {
			const stocks = buildStocks();
			const depletion = {};
			stocks.forEach(function(stock) {
				depletion[stock._id] = stock.quantityDepleted;
			});

			const sandbox = sinon.createSandbox();
			sandbox.stub(db, 'updateOne').callsFake(function(model, filter, update, callback) {
				callback(true);
			});
			sandbox.stub(db, 'findOne').callsFake(function(model, query, projection, callback) {
				callback(Object.assign({}, transaction));
			});
			sandbox.stub(db, 'findMany').callsFake(function(model, query, projection, callback) {
				callback(stocks);
			});
			sandbox.stub(db, 'updateOneIterative').callsFake(function(model, filter, update) {
				depletion[filter._id] = update.quantityDepleted;
			});
			try {
				await new Promise(function(resolve) {
					const res = {status: sinon.stub().returnsThis(), json: sinon.stub(), send: sinon.stub().callsFake(resolve)};
					transactionController[HANDLERS[newStatus]]({body: {transactionId: transaction.id, transactionStatusOld: oldStatus}}, res);
				});
			} finally {
				sandbox.restore();
			}
			return depletion;
		}

		async function serviceDepletion(transaction, oldStatus, newStatus) {
			const stocks = buildStocks();
			const depletion = {};
			stocks.forEach(function(stock) {
				depletion[stock._id] = stock.quantityDepleted;
			});
			const repo = {
				findAll: sinon.stub().resolves(stocks),
				saveDepleted: sinon.stub().callsFake(function(saved) {
					saved.forEach(function(stock) {
						depletion[stock._id] = stock.quantityDepleted;
					});
				})
			};
			await StockService.adjust({transaction: Object.assign({}, transaction), oldStatus: oldStatus, newStatus: newStatus}, repo);
			return depletion;
		}

		const TRANSITIONS = [];
		['pending', 'completed', 'cancelled', undefined].forEach(function(oldStatus) {
			['pending', 'completed', 'cancelled'].forEach(function(newStatus) {
				TRANSITIONS.push([oldStatus, newStatus]);
			});
		});

		TRANSITIONS.forEach(function(transition) {
			const oldStatus = transition[0];
			const newStatus = transition[1];
			it(String(oldStatus) + ' -> ' + newStatus + ': 30 transações aleatórias', async function() {
				const limits = newStatus === 'cancelled' ? LIMITS.return : LIMITS.consume;
				for (let n = 0; n < 30; n++) {
					const transaction = randomTransaction(limits);
					const expected = await handlerDepletion(transaction, oldStatus, newStatus);
					const actual = await serviceDepletion(transaction, oldStatus, newStatus);
					expect(actual, JSON.stringify(transaction)).to.deep.equal(expected);
				}
			});
		});
	});
});
