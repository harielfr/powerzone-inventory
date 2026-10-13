/* Adapter that exposes the transaction collection of models/db.js through a Promise-based interface */
const defaultDb = require('../models/db.js');
const Transaction = require('../models/transaction-schema.js');

/**
 * Repository for the transaction collection.
 */
class TransactionRepository {
	/**
	 * @param {Object} db  Database access object (defaults to models/db.js).
	 */
	constructor(db = defaultDb) {
		this.db = db;
	}

	/**
	 * Retrieves a transaction using its ID.
	 *
	 * @param {number|string} id  ID of the transaction.
	 * @param {string} projection  Fields to be returned.
	 * @return {Promise<Object>} Resolves with the transaction, or false if the retrieval failed.
	 */
	findById(id, projection) {
		return new Promise((resolve) => {
			this.db.findOne(Transaction, {id: id}, projection, resolve);
		});
	}

	/**
	 * Updates the status of a transaction.
	 *
	 * @param {number|string} id  ID of the transaction.
	 * @param {string} status  New status of the transaction.
	 * @return {Promise<boolean>} Resolves with whether the update succeeded.
	 */
	updateStatus(id, status) {
		return new Promise((resolve) => {
			this.db.updateOne(Transaction, {id: id}, {status: status}, resolve);
		});
	}
}

module.exports = TransactionRepository;
