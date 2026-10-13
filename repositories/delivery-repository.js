/* Adapter that exposes the delivery collection of models/db.js through a Promise-based interface */
const defaultDb = require('../models/db.js');
const Delivery = require('../models/delivery-schema.js');

/**
 * Repository for the delivery collection.
 */
class DeliveryRepository {
	/**
	 * @param {Object} db  Database access object (defaults to models/db.js).
	 */
	constructor(db = defaultDb) {
		this.db = db;
	}

	/**
	 * Updates the status of a delivery.
	 *
	 * @param {number|string} id  ID of the delivery.
	 * @param {string} status  New status of the delivery.
	 * @return {Promise<boolean>} Resolves with whether the update succeeded.
	 */
	updateStatus(id, status) {
		return new Promise((resolve) => {
			this.db.updateOne(Delivery, {id: id}, {status: status}, resolve);
		});
	}
}

module.exports = DeliveryRepository;
