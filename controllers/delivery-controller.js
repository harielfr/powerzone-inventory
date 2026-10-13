/* Controller for displaying the delivery page */

/* The db file, delivery schema, transaction schema, and inventory schema are used for the delivery page. */
const db = require('../models/db.js');
const Delivery = require('../models/delivery-schema.js');
const Transaction = require('../models/transaction-schema.js');
const Inventory = require('../models/inventory-schema.js');

/* The handlers that change the status of a delivery (and of its transaction) are in handlers/. */
const {
	CancelledDeliveryHandler,
	CompletedDeliveryHandler,
	PendingDeliveryHandler
} = require('../handlers/delivery-status-handlers.js');

const cancelledDeliveryHandler = new CancelledDeliveryHandler();
const completedDeliveryHandler = new CompletedDeliveryHandler();
const pendingDeliveryHandler = new PendingDeliveryHandler();

/* A utility object is used for auxiliary functions. */
const deliveryControllerUtil = require('./delivery-controller-util.js');

/* The transaction controller is used to update the transaction status.*/
const transactionController = require('./transaction-controller.js');

const deliveryController = {
	/**
	 * Gets the delivery page.
	 *
	 * @param {Express.Request} req  Object that contains information on the HTTP request from the client.
	 * @param {Express.Response} res  Object that contains information on the HTTP response from the server.
	 */
	getDelivery: function(req, res) {
		/* Retrieve the details of all deliveries. */
		const query = {};
		const projection = 'id date customer dropoff status';

		db.findMany(Delivery, query, projection, function(result) {
			const deliveryDetails = deliveryControllerUtil.deliveryUtil(result);

			/* Retrieve the details of all transactions. */
			const queryTransaction = {};
			const projectionTransaction = 'litersGasoline litersPremiumGasoline95 litersDiesel litersPremiumGasoline97 litersKerosene';

			db.findMany(Transaction, queryTransaction, projectionTransaction, function(result) {
				const transactionDetails = deliveryControllerUtil.transactionOrdersUtil(result);

				/* Retrieve the available fuel amounts in the inventory. */
				const queryInventory = {};
				const projectionInventory = '_id type quantityPurchased quantityDepleted';

				db.findMany(Inventory, queryInventory, projectionInventory, function(result) {
					const inventoryDetails = deliveryControllerUtil.inventoryAmountsUtil(result);

					/* Store the details in the variable data. */
					const data = {
						deliveryIds: deliveryDetails.ids,
						deliveryDates: deliveryDetails.dates,
						deliveryCustomers: deliveryDetails.customers,
						deliveryDropoffs: deliveryDetails.dropoffs,
						deliveryStatuses: deliveryDetails.statuses,

						deliveryLitersGasoline: transactionDetails.litersGasoline,
						deliveryLitersPremiumGasoline95: transactionDetails.litersPremiumGasoline95,
						deliveryLitersDiesel: transactionDetails.litersDiesel,
						deliveryLitersPremiumGasoline97: transactionDetails.litersPremiumGasoline97,
						deliveryLitersKerosene: transactionDetails.litersKerosene,

						deliveryTotalGasoline: inventoryDetails.totalGasoline,
						deliveryTotalPremiumGasoline95: inventoryDetails.totalPremiumGasoline95,
						deliveryTotalDiesel: inventoryDetails.totalDiesel,
						deliveryTotalPremiumGasoline97: inventoryDetails.totalPremiumGasoline97,
						deliveryTotalKerosene: inventoryDetails.totalKerosene,

						/* Additionally, store the role of the account to authorize the add and edit transaction features. */
						role: req.session.role
					};

					res.render('delivery', data);
				});
			});
		});
	},

	/**
	 * Updates the status of the selected delivery to "Cancelled".
	 *
	 * @param {Express.Request} req  Object that contains information on the HTTP request from the client.
	 * @param {Express.Response} res  Object that contains information on the HTTP response from the server.
	 * @return {Promise<void>} Resolves when the response has been sent.
	 */
	postEditStatusCancelled: function(req, res) {
		return cancelledDeliveryHandler.handle(req, res);
	},

	/**
	 * Updates the status of the selected delivery to "Completed".
	 *
	 * @param {Express.Request} req  Object that contains information on the HTTP request from the client.
	 * @param {Express.Response} res  Object that contains information on the HTTP response from the server.
	 * @return {Promise<void>} Resolves when the response has been sent.
	 */
	postEditStatusCompleted: function(req, res) {
		return completedDeliveryHandler.handle(req, res);
	},

	/**
	 * Updates the status of the selected delivery to "Pending".
	 *
	 * @param {Express.Request} req  Object that contains information on the HTTP request from the client.
	 * @param {Express.Response} res  Object that contains information on the HTTP response from the server.
	 * @return {Promise<void>} Resolves when the response has been sent.
	 */
	postEditStatusPending: function(req, res) {
		return pendingDeliveryHandler.handle(req, res);
	},

	/**
	 * Gets the page displaying more information for a particular delivery.
	 *
	 * @param {Express.Request} req  Object that contains information on the HTTP request from the client.
	 * @param {Express.Response} res  Object that contains information on the HTTP response from the server.
	 */
	getMoreInfoDelivery: function(req, res) {
		/* Retrieve the delivery ID from the page link. */
		const id = req.params.id;

		/* Retrieve the data corresponding to the ID of the selected delivery. */
		const query = {id: id};
		const projection = 'id status customer number date warehouse dropoff manager driver';

		db.findOne(Delivery, query, projection, function(result) {
			/* Format the display of the delivery date from the Date object, if applicable,
             * stored in the database.
             */
			let cleanDate = null;

			if (result.date != null) {
				const month = result.date.getMonth() + 1;
				let formattedMonth = month;
				if (month.toString().length < 2) {
					formattedMonth = '0' + month.toString();
				}

				const date = result.date.getDate();
				let formattedDate = date;
				if (date.toString().length < 2) {
					formattedDate = '0' + date.toString();
				}

				const year = result.date.getFullYear();

				cleanDate = year + '-' + formattedMonth + '-' + formattedDate;
			}

			/* Store the delivery details in the variable data. */
			const data = {
				id: result.id,
				date: cleanDate,
				status: result.status,
				customer: result.customer,
				number: result.number,
				warehouse: result.warehouse,
				dropoff: result.dropoff,
				manager: result.manager,
				driver: result.driver
			};

			res.render('more-info-delivery', data);
		});
	},

	/**
	 * Gets the page for editing information on a particular delivery.
	 *
	 * @param {Express.Request} req  Object that contains information on the HTTP request from the client.
	 * @param {Express.Response} res  Object that contains information on the HTTP response from the server.
	 */
	getEditDelivery: function(req, res) {
		/* Retrieve the delivery ID from the page link. */
		const id = req.params.id;

		/* Retrieve the data corresponding to the ID of the selected delivery. */
		const query = {id: id};
		const projection = 'id customer number date status warehouse dropoff manager driver';

		db.findOne(Delivery, query, projection, function(result) {
			/* Store the result of the database retrieval in the variable deliveryDetails. */
			const deliveryDetails = result;

			/* Format the display of the delivery date from the Date object, if applicable,
             * stored in the database.
             */
			let cleanDate = null;

			if (result.date != null) {
				const month = result.date.getMonth() + 1;
				let formattedMonth = month;
				if (month.toString().length < 2) {
					formattedMonth = '0' + month.toString();
				}

				const date = result.date.getDate();
				let formattedDate = date;
				if (date.toString().length < 2) {
					formattedDate = '0' + date.toString();
				}

				const year = result.date.getFullYear();

				cleanDate = year + '-' + formattedMonth + '-' + formattedDate;
			}

			/* The transaction ID corresponding to a delivery has a starting digit of 1 and the same
			 * succeeding digits as the delivery ID.
			 */
			const transactionId = parseInt(id) - 10000000;

			/* Retrieve the amounts of fuel ordered in the transaction. */
			const queryTransaction = {id: transactionId};
			const projectionTransaction = 'litersGasoline litersPremiumGasoline95 litersDiesel litersPremiumGasoline97 litersKerosene';

			db.findOne(Transaction, queryTransaction, projectionTransaction, function(result) {
				/* Store the result of the database retrieval in the variable transactionDetails. */
				const transactionDetails = result;

				/* Store the total quantities and statuses of each type of fuel in the inventory. */
				let totalGasoline = 0;
				let totalPremiumGasoline95 = 0;
				let totalDiesel = 0;
				let totalPremiumGasoline97 = 0;
				let totalKerosene = 0;

				/* Retrieve the available fuel amounts in the inventory. */
				const queryInventory = {};
				const projectionInventory = '_id type quantityPurchased quantityDepleted';

				db.findMany(Inventory, queryInventory, projectionInventory, function(result) {
					/* Assign the result of the database retrieval to the variable purchases. */
					const purchases = result;

					/* For each purchase, update the total fuel quantities accordingly and store the purchase
					 * details in the individual arrays.
					 */
					for (let i = 0; i < purchases.length; i++) {
						if (purchases[i].type == 'gasoline') {
							totalGasoline += (purchases[i].quantityPurchased - purchases[i].quantityDepleted);
						} else if (purchases[i].type == 'premium-gasoline-95') {
							totalPremiumGasoline95 += (purchases[i].quantityPurchased - purchases[i].quantityDepleted);
						} else if (purchases[i].type == 'diesel') {
							totalDiesel += (purchases[i].quantityPurchased - purchases[i].quantityDepleted);
						} else if (purchases[i].type == 'premium-gasoline-97') {
							totalPremiumGasoline97 += (purchases[i].quantityPurchased - purchases[i].quantityDepleted);
						} else {
							totalKerosene += (purchases[i].quantityPurchased - purchases[i].quantityDepleted);
						}
					}

					/* Store the details and total fuel amounts in the variable data. */
					const data = {
						id: deliveryDetails.id,
						date: cleanDate,
						status: deliveryDetails.status,
						customer: deliveryDetails.customer,
						number: deliveryDetails.number,
						warehouse: deliveryDetails.warehouse,
						dropoff: deliveryDetails.dropoff,
						manager: deliveryDetails.manager,
						driver: deliveryDetails.driver,

						litersGasoline: transactionDetails.litersGasoline,
						litersPremiumGasoline95: transactionDetails.litersPremiumGasoline95,
						litersDiesel: transactionDetails.litersDiesel,
						litersPremiumGasoline97: transactionDetails.litersPremiumGasoline97,
						litersKerosene: transactionDetails.litersKerosene,

						totalGasoline: totalGasoline,
						totalPremiumGasoline95: totalPremiumGasoline95,
						totalDiesel: totalDiesel,
						totalPremiumGasoline97: totalPremiumGasoline97,
						totalKerosene: totalKerosene
					};

					res.render('edit-delivery', data);
				});
			});
		});
	},

	/**
	 * Edits the details of a delivery.
	 *
	 * @param {Express.Request} req  Object that contains information on the HTTP request from the client.
	 * @param {Express.Response} res  Object that contains information on the HTTP response from the server.
	 */
	postEditDelivery: function(req, res) {
		/* Retrieve the delivery details from the user input. */
		const id = req.body.editDeliveryId;
		const warehouse = req.body.editDeliveryWarehouse.trim();
		const status = req.body.editDeliveryStatus;
		const dropoff = req.body.editDeliveryDropoff.trim();
		const customer = req.body.editDeliveryCustomerName.trim();
		const manager = req.body.editDeliveryManager.trim();
		const number = req.body.editDeliveryCustomerNumber;
		const driver = req.body.editDeliveryDriver.trim();
		const date = req.body.editDeliveryDate;

		/* Use the delivery ID for database retrieval. */
		const filter = {id: id};

		/* Assign the updated details to the update variable. */
		const update = {
			warehouse: warehouse,
			status: status,
			dropoff: dropoff,
			customer: customer,
			manager: manager,
			number: number,
			driver: driver,
			date: date
		};

		db.updateOne(Delivery, filter, update, function(flag) {
			/* If the delivery status is set to "Completed", set the status of its corresponding transaction
			 * to "Completed."
			 */
			if (status == 'completed') {
				/* The transaction ID corresponding to a delivery has a starting digit of 1 and the same
				 * succeeding digits as the delivery ID.
				 */
				const transactionId = parseInt(id) - 10000000;

				/* Get the original status of the corresponding transaction. */
				query = {id: transactionId};
				projection = 'id status';

				db.findOne(Transaction, query, projection, function(result) {
					/* Assign the retrieved transaction details to the body of the request object
					 * and set the status of the transaction to "Completed."
					 */
					req.body.transactionId = result.id;
					req.body.transactionStatusOld = result.status;

					transactionController.postEditStatusCompleted(req, res);
				});

			/* If the delivery status is set to "Pending", set the status of its corresponding transaction
			 * to "Pending."
			 */
			} else if (status == 'pending') {
				/* The transaction ID corresponding to a delivery has a starting digit of 1 and the same
				 * succeeding digits as the delivery ID.
				 */
				const transactionId = parseInt(id) - 10000000;

				/* Get the original status of the corresponding transaction. */
				query = {id: transactionId};
				projection = 'id status';

				db.findOne(Transaction, query, projection, function(result) {
					/* Assign the retrieved transaction details to the body of the request object
					* and set the status of the transaction to "Pending."
					*/
					req.body.transactionId = result.id;
					req.body.transactionStatusOld = result.status;

					transactionController.postEditStatusPending(req, res);
				});

			/* Otherwise, if the delivery status is set to "Cancelled", set the status of its
			 * corresponding transaction to "Cancelled."
			 */
			} else {
				/* The transaction ID corresponding to a delivery has a starting digit of 1 and the same
				 * succeeding digits as the delivery ID.
				 */
				const transactionId = parseInt(id) - 10000000;

				/* Get the original status of the corresponding transaction. */
				query = {id: transactionId};
				projection = 'id status';

				db.findOne(Transaction, query, projection, function(result) {
					/* Assign the retrieved transaction details to the body of the request object
					 * and set the status of the transaction to "Cancelled."
					 */
					req.body.transactionId = result.id;
					req.body.transactionStatusOld = result.status;

					transactionController.postEditStatusCancelled(req, res);
				});
			}
		});
	}
};

module.exports = deliveryController;
