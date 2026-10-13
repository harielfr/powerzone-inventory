const assert = require('chai').assert;
const sinon = require('sinon');

const StatusChangeHandler = require('../handlers/status-change-handler.js');
const {
	CancelledTransactionHandler,
	CompletedTransactionHandler,
	PendingTransactionHandler
} = require('../handlers/transaction-status-handlers.js');
const {
	CancelledDeliveryHandler,
	CompletedDeliveryHandler,
	PendingDeliveryHandler
} = require('../handlers/delivery-status-handlers.js');

const STOCK_PROJECTION = 'id litersGasoline litersPremiumGasoline95 litersDiesel litersPremiumGasoline97 litersKerosene';

/**
 * Creates a fake response object.
 *
 * @return {Object} Response whose status() returns itself, with spies for status, json, and send.
 */
function createRes() {
	const res = {
		json: sinon.spy(),
		send: sinon.spy()
	};
	res.status = sinon.stub().returns(res);
	return res;
}

describe('the abstract status change handler', function() {
	it('should require the subclasses to define the target status and the steps', function() {
		const handler = new StatusChangeHandler();

		assert.throws(() => handler.targetStatus, 'targetStatus');
		assert.throws(() => handler.updateStatus({}), 'updateStatus');
		assert.throws(() => handler.propagate({}, {}), 'propagate');
	});

	it('should run the steps in order: update the status, propagate, and respond', async function() {
		const calls = [];

		/** Handler that records the order of the steps. */
		class FakeHandler extends StatusChangeHandler {
			/** @return {Promise} Resolved promise. */
			updateStatus() {
				calls.push('update');
				return Promise.resolve();
			}

			/** @return {Promise} Resolved promise. */
			propagate() {
				calls.push('propagate');
				return Promise.resolve();
			}

			/** Records the step. */
			respond() {
				calls.push('respond');
			}
		}

		await new FakeHandler().handle({}, {});

		assert.deepEqual(calls, ['update', 'propagate', 'respond']);
	});

	it('should respond with status 200 and the success message', function() {
		const res = createRes();

		new StatusChangeHandler().respond(res);

		assert.isTrue(res.status.calledOnceWithExactly(200));
		assert.isTrue(res.json.calledOnceWithExactly('Delivery status updated successfully!'));
		assert.isTrue(res.send.calledOnce);
	});
});

describe('the transaction status handlers', function() {
	const cases = [
		{name: 'cancelled', Handler: CancelledTransactionHandler, oldStatus: 'pending'},
		{name: 'completed', Handler: CompletedTransactionHandler, oldStatus: 'cancelled'},
		{name: 'pending', Handler: PendingTransactionHandler, oldStatus: 'cancelled'}
	];

	cases.forEach(function({name, Handler, oldStatus}) {
		describe('for the status "' + name + '"', function() {
			let transactionRepo;
			let deliveryRepo;
			let inventoryRepo;
			let stockService;
			let res;
			let req;
			const transaction = {id: 10000007, litersDiesel: 5};

			beforeEach(function() {
				transactionRepo = {
					updateStatus: sinon.stub().resolves(true),
					findById: sinon.stub().resolves(transaction)
				};
				deliveryRepo = {updateStatus: sinon.stub().resolves(true)};
				inventoryRepo = {};
				stockService = {adjust: sinon.stub().resolves()};
				res = createRes();
				req = {body: {transactionId: '10000007', transactionStatusOld: oldStatus}};
			});

			it('should update the status of the transaction, adjust the stocks, update the delivery, and respond, in that order', async function() {
				await new Handler({transactionRepo, deliveryRepo, inventoryRepo, stockService}).handle(req, res);

				sinon.assert.callOrder(
					transactionRepo.updateStatus,
					transactionRepo.findById,
					stockService.adjust,
					deliveryRepo.updateStatus,
					res.status,
					res.json,
					res.send
				);
			});

			it('should pass the right arguments to each collaborator', async function() {
				await new Handler({transactionRepo, deliveryRepo, inventoryRepo, stockService}).handle(req, res);

				assert.isTrue(transactionRepo.updateStatus.calledOnceWithExactly('10000007', name));
				assert.isTrue(transactionRepo.findById.calledOnceWithExactly('10000007', STOCK_PROJECTION));
				assert.isTrue(stockService.adjust.calledOnceWithExactly({
					transaction: transaction,
					oldStatus: oldStatus,
					newStatus: name
				}, inventoryRepo));
				assert.isTrue(deliveryRepo.updateStatus.calledOnceWithExactly(20000007, name));
			});

			it('should neither read the transaction nor adjust the stocks when the change does not affect them', async function() {
				req.body.transactionStatusOld = name;

				await new Handler({transactionRepo, deliveryRepo, inventoryRepo, stockService}).handle(req, res);

				assert.isTrue(transactionRepo.findById.notCalled);
				assert.isTrue(stockService.adjust.notCalled);
				assert.isTrue(transactionRepo.updateStatus.calledOnceWithExactly('10000007', name));
				assert.isTrue(deliveryRepo.updateStatus.calledOnceWithExactly(20000007, name));
				assert.isTrue(res.send.calledOnce);
			});

			it('should respond with status 200 and the success message', async function() {
				await new Handler({transactionRepo, deliveryRepo, inventoryRepo, stockService}).handle(req, res);

				assert.isTrue(res.status.calledOnceWithExactly(200));
				assert.isTrue(res.json.calledOnceWithExactly('Delivery status updated successfully!'));
				assert.isTrue(res.send.calledOnce);
			});

			it('should not respond before the stocks have been adjusted', async function() {
				let resolveAdjust;
				stockService.adjust = sinon.stub().returns(new Promise((resolve) => {
					resolveAdjust = resolve;
				}));

				const done = new Handler({transactionRepo, deliveryRepo, inventoryRepo, stockService}).handle(req, res);
				await new Promise((resolve) => setImmediate(resolve));

				assert.isTrue(res.send.notCalled);
				assert.isTrue(deliveryRepo.updateStatus.notCalled);

				resolveAdjust();
				await done;

				assert.isTrue(res.send.calledOnce);
			});
		});
	});
});

describe('the delivery status handlers', function() {
	const cases = [
		{name: 'cancelled', Handler: CancelledDeliveryHandler, Expected: CancelledTransactionHandler},
		{name: 'completed', Handler: CompletedDeliveryHandler, Expected: CompletedTransactionHandler},
		{name: 'pending', Handler: PendingDeliveryHandler, Expected: PendingTransactionHandler}
	];

	cases.forEach(function({name, Handler, Expected}) {
		describe('for the status "' + name + '"', function() {
			let deliveryRepo;
			let transactionRepo;
			let transactionHandler;
			let res;
			let req;

			beforeEach(function() {
				deliveryRepo = {updateStatus: sinon.stub().resolves(true)};
				transactionRepo = {findById: sinon.stub().resolves({id: 10000007, status: 'completed'})};
				transactionHandler = {handle: sinon.stub().resolves()};
				res = createRes();
				req = {body: {deliveryId: '20000007'}};
			});

			it('should update the delivery, retrieve its transaction, and delegate to the transaction handler, in that order', async function() {
				await new Handler({deliveryRepo, transactionRepo, transactionHandler}).handle(req, res);

				sinon.assert.callOrder(deliveryRepo.updateStatus, transactionRepo.findById, transactionHandler.handle);
			});

			it('should pass the right arguments and fill the request body with the transaction details', async function() {
				await new Handler({deliveryRepo, transactionRepo, transactionHandler}).handle(req, res);

				assert.isTrue(deliveryRepo.updateStatus.calledOnceWithExactly('20000007', name));
				assert.isTrue(transactionRepo.findById.calledOnceWithExactly(10000007, 'id status'));
				assert.strictEqual(req.body.transactionId, 10000007);
				assert.strictEqual(req.body.transactionStatusOld, 'completed');
				assert.isTrue(transactionHandler.handle.calledOnceWithExactly(req, res));
			});

			it('should leave the response to the transaction handler', async function() {
				await new Handler({deliveryRepo, transactionRepo, transactionHandler}).handle(req, res);

				assert.isTrue(res.send.notCalled);
			});

			it('should delegate to the transaction handler of the same status by default', function() {
				const handler = new Handler({deliveryRepo, transactionRepo, transactionHandler: undefined});
				assert.instanceOf(handler.transactionHandler, Expected);
			});
		});
	});

	it('should send a single response when combined with the transaction handler', async function() {
		const transactionRepo = {
			findById: sinon.stub().callsFake((id, projection) => Promise.resolve(
				projection === 'id status' ? {id: 10000007, status: 'pending'} : {id: 10000007}
			)),
			updateStatus: sinon.stub().resolves(true)
		};
		const deliveryRepo = {updateStatus: sinon.stub().resolves(true)};
		const stockService = {adjust: sinon.stub().resolves()};
		const inventoryRepo = {};
		const res = createRes();
		const req = {body: {deliveryId: 20000007}};

		const transactionHandler = new CancelledTransactionHandler({transactionRepo, deliveryRepo, inventoryRepo, stockService});
		await new CancelledDeliveryHandler({deliveryRepo, transactionRepo, transactionHandler}).handle(req, res);

		assert.isTrue(res.send.calledOnce);
		assert.isTrue(res.json.calledOnceWithExactly('Delivery status updated successfully!'));
		assert.isTrue(stockService.adjust.calledOnceWithExactly({
			transaction: {id: 10000007},
			oldStatus: 'pending',
			newStatus: 'cancelled'
		}, inventoryRepo));
		assert.isTrue(deliveryRepo.updateStatus.calledTwice);
		assert.isTrue(deliveryRepo.updateStatus.alwaysCalledWith(sinon.match.number.or(sinon.match.string), 'cancelled'));
	});
});
