const assert = require('chai').assert;
const sinon = require('sinon');

const ids = require('../repositories/ids.js');
const InventoryRepository = require('../repositories/inventory-repository.js');
const TransactionRepository = require('../repositories/transaction-repository.js');
const DeliveryRepository = require('../repositories/delivery-repository.js');
const Inventory = require('../models/inventory-schema.js');
const Transaction = require('../models/transaction-schema.js');
const Delivery = require('../models/delivery-schema.js');

describe('the functions to convert between transaction IDs and delivery IDs', function() {
	it('should add 10000000 to a transaction ID to get the delivery ID', function() {
		assert.strictEqual(ids.transactionToDelivery(10000005), 20000005);
	});

	it('should subtract 10000000 from a delivery ID to get the transaction ID', function() {
		assert.strictEqual(ids.deliveryToTransaction(20000005), 10000005);
	});

	it('should accept IDs given as strings', function() {
		assert.strictEqual(ids.transactionToDelivery('10000005'), 20000005);
		assert.strictEqual(ids.deliveryToTransaction('20000005'), 10000005);
	});
});

describe('the inventory repository', function() {
	let db;
	let repo;

	beforeEach(function() {
		db = {
			findMany: sinon.stub(),
			updateOneIterative: sinon.spy()
		};
		repo = new InventoryRepository(db);
	});

	it('should retrieve all stocks with the fields needed for the FIFO computation', async function() {
		const stocks = [{_id: 'a'}, {_id: 'b'}];
		db.findMany.callsFake((model, query, projection, callback) => callback(stocks));

		const result = await repo.findAll();

		assert.strictEqual(result, stocks);
		assert.isTrue(db.findMany.calledOnceWithExactly(Inventory, {}, '_id type date quantityPurchased quantityDepleted', sinon.match.func));
	});

	it('should resolve with an empty list if the retrieval fails', async function() {
		db.findMany.callsFake((model, query, projection, callback) => callback(false));

		assert.deepEqual(await repo.findAll(), []);
	});

	it('should save the depleted quantity once per stock', function() {
		repo.saveDepleted([{_id: 'a', quantityDepleted: 3}, {_id: 'b', quantityDepleted: 7}]);

		assert.isTrue(db.updateOneIterative.calledTwice);
		assert.isTrue(db.updateOneIterative.firstCall.calledWithExactly(Inventory, {_id: 'a'}, {quantityDepleted: 3}));
		assert.isTrue(db.updateOneIterative.secondCall.calledWithExactly(Inventory, {_id: 'b'}, {quantityDepleted: 7}));
	});

	it('should not call the database when there are no stocks to save', function() {
		repo.saveDepleted([]);

		assert.isTrue(db.updateOneIterative.notCalled);
	});
});

describe('the transaction repository', function() {
	let db;
	let repo;

	beforeEach(function() {
		db = {
			findOne: sinon.stub(),
			updateOne: sinon.stub()
		};
		repo = new TransactionRepository(db);
	});

	it('should find a transaction by ID using the given projection', async function() {
		const transaction = {id: 10000001, status: 'pending'};
		db.findOne.callsFake((model, query, projection, callback) => callback(transaction));

		const result = await repo.findById(10000001, 'id status');

		assert.strictEqual(result, transaction);
		assert.isTrue(db.findOne.calledOnceWithExactly(Transaction, {id: 10000001}, 'id status', sinon.match.func));
	});

	it('should update the status of a transaction by ID', async function() {
		db.updateOne.callsFake((model, filter, update, callback) => callback(true));

		const result = await repo.updateStatus(10000001, 'cancelled');

		assert.isTrue(result);
		assert.isTrue(db.updateOne.calledOnceWithExactly(Transaction, {id: 10000001}, {status: 'cancelled'}, sinon.match.func));
	});

	it('should resolve with false if the update fails', async function() {
		db.updateOne.callsFake((model, filter, update, callback) => callback(false));

		assert.isFalse(await repo.updateStatus(10000001, 'cancelled'));
	});
});

describe('the delivery repository', function() {
	let db;
	let repo;

	beforeEach(function() {
		db = {
			updateOne: sinon.stub()
		};
		repo = new DeliveryRepository(db);
	});

	it('should update the status of a delivery by ID', async function() {
		db.updateOne.callsFake((model, filter, update, callback) => callback(true));

		const result = await repo.updateStatus(20000001, 'completed');

		assert.isTrue(result);
		assert.isTrue(db.updateOne.calledOnceWithExactly(Delivery, {id: 20000001}, {status: 'completed'}, sinon.match.func));
	});

	it('should resolve with false if the update fails', async function() {
		db.updateOne.callsFake((model, filter, update, callback) => callback(false));

		assert.isFalse(await repo.updateStatus(20000001, 'completed'));
	});
});
