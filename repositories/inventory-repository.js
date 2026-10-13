/* Adapter that exposes the inventory collection of models/db.js through a Promise-based interface */
const defaultDb = require('../models/db.js');
const Inventory = require('../models/inventory-schema.js');

const STOCK_PROJECTION = '_id type date quantityPurchased quantityDepleted';

/**
 * Repository for the inventory collection.
 */
class InventoryRepository {
	/**
	 * @param {Object} db  Database access object (defaults to models/db.js).
	 */
	constructor(db = defaultDb) {
		this.db = db;
	}

	/**
	 * Retrieves the type, date, and quantities of all inventory stocks.
	 *
	 * @return {Promise<Object[]>} Resolves with the stocks, or false if the retrieval failed.
	 */
	findAll() {
		return new Promise((resolve) => {
			this.db.findMany(Inventory, {}, STOCK_PROJECTION, resolve);
		});
	}

	/**
	 * Saves the depleted quantity of each stock. Fire-and-forget, as in the original code.
	 *
	 * @param {Object[]} stocks  Stocks whose depleted quantity is to be saved.
	 */
	saveDepleted(stocks) {
		for (const stock of stocks) {
			this.db.updateOneIterative(Inventory, {_id: stock._id}, {quantityDepleted: stock.quantityDepleted});
		}
	}
}

module.exports = InventoryRepository;
