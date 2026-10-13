/* Conversion between transaction IDs and delivery IDs.
 * The delivery ID corresponding to a transaction is the transaction ID plus 10000000, and vice versa.
 */
const OFFSET = 10000000;

const ids = {
	/**
	 * Gets the ID of the delivery that corresponds to a transaction.
	 *
	 * @param {number|string} transactionId  ID of the transaction.
	 * @return {number} ID of the corresponding delivery.
	 */
	transactionToDelivery: function(transactionId) {
		return parseInt(transactionId) + OFFSET;
	},

	/**
	 * Gets the ID of the transaction that corresponds to a delivery.
	 *
	 * @param {number|string} deliveryId  ID of the delivery.
	 * @return {number} ID of the corresponding transaction.
	 */
	deliveryToTransaction: function(deliveryId) {
		return parseInt(deliveryId) - OFFSET;
	}
};

module.exports = ids;
