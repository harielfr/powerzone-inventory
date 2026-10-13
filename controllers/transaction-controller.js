/* Controller for displaying the transactions page */

/* The db file, transaction schema, inventory schema, transaction number schema, selling price schema, and
 * delivery schema are used for the transaction page.
 */
const db = require('../models/db.js');
const Transaction = require('../models/transaction-schema.js');
const Inventory = require('../models/inventory-schema.js');
const TransactionNumber = require('../models/transaction-number-schema.js');
const Price = require('../models/selling-price-schema.js');
const Delivery = require('../models/delivery-schema.js');

/* The handlers that change the status of a transaction (and of its delivery) are in handlers/. */
const {
	CancelledTransactionHandler,
	CompletedTransactionHandler,
	PendingTransactionHandler
} = require('../handlers/transaction-status-handlers.js');

const cancelledHandler = new CancelledTransactionHandler();
const completedHandler = new CompletedTransactionHandler();
const pendingHandler = new PendingTransactionHandler();

const transactionController = {
	/**
	 * Gets the transactions page.
	 *
	 * @param {Express.Request} req  Object that contains information on the HTTP request from the client.
	 * @param {Express.Response} res  Object that contains information on the HTTP response from the server.
	 */
	getTransaction: function(req, res) {
		/* Store the details and order amounts of all transactions in individual arrays to allow
		 * for further formatting.
		 */
		const ids = [];
		const dates = [];
		const customers = [];
		const discountedTotals = [];
		const statuses = [];
		const litersGasoline = [];
		const litersPremiumGasoline95 = [];
		const litersDiesel = [];
		const litersPremiumGasoline97 = [];
		const litersKerosene = [];

		/* Retrieve the details of all transactions. */
		const query = {};
		const projection = 'id date customer priceDiscounted status litersGasoline litersPremiumGasoline95 litersDiesel litersPremiumGasoline97 litersKerosene';

		db.findMany(Transaction, query, projection, function(result) {
			/* Assign the result of the database retrieval to the variable transactions. */
			const transactions = result;

			/* For each transaction, store the transaction details in the individual arrays. */
			for (let i = 0; i < transactions.length; i++) {
				/* Format the display of the transaction date from the Date object
				 * stored in the database
				 */
				const month = transactions[i].date.getMonth() + 1;
				let formattedMonth = month;
				if (month.toString().length < 2) {
					formattedMonth = '0' + month.toString();
				}

				const date = transactions[i].date.getDate();
				let formattedDate = date;
				if (date.toString().length < 2) {
					formattedDate = '0' + date.toString();
				}

				const year = transactions[i].date.getFullYear();

				/* Store the transaction details in their respective arrays. */
				ids[i] = transactions[i].id;
				dates[i] = formattedMonth + '/' + formattedDate + '/' + year;
				customers[i] = transactions[i].customer;
				discountedTotals[i] = transactions[i].priceDiscounted;
				statuses[i] = transactions[i].status;
				litersGasoline[i] = transactions[i].litersGasoline;
				litersPremiumGasoline95[i] = transactions[i].litersPremiumGasoline95;
				litersDiesel[i] = transactions[i].litersDiesel;
				litersPremiumGasoline97[i] = transactions[i].litersPremiumGasoline97;
				litersKerosene[i] = transactions[i].litersKerosene;
			}

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

				/* Store the retrieved transaction details in the variable data. */
				const data = {
					transactionIds: ids,
					transactionDates: dates,
					transactionCustomers: customers,
					transactionDiscountedTotals: discountedTotals,
					transactionStatuses: statuses,

					transactionLitersGasoline: litersGasoline,
					transactionLitersPremiumGasoline95: litersPremiumGasoline95,
					transactionLitersDiesel: litersDiesel,
					transactionLitersPremiumGasoline97: litersPremiumGasoline97,
					transactionLitersKerosene: litersKerosene,

					transactionTotalGasoline: totalGasoline,
					transactionTotalPremiumGasoline95: totalPremiumGasoline95,
					transactionTotalDiesel: totalDiesel,
					transactionTotalPremiumGasoline97: totalPremiumGasoline97,
					transactionTotalKerosene: totalKerosene,

					/* Additionally, store the role of the account to authorize the add and edit transaction features. */
					role: req.session.role
				};

				res.render('transaction', data);
			});
		});
	},

	/**
	 * Updates the status of the selected transaction to "Cancelled".
	 *
	 * @param {Express.Request} req  Object that contains information on the HTTP request from the client.
	 * @param {Express.Response} res  Object that contains information on the HTTP response from the server.
	 * @return {Promise<void>} Resolves when the response has been sent.
	 */
	postEditStatusCancelled: function(req, res) {
		return cancelledHandler.handle(req, res);
	},

	/**
	 * Updates the status of the selected transaction to "Completed".
	 *
	 * @param {Express.Request} req  Object that contains information on the HTTP request from the client.
	 * @param {Express.Response} res  Object that contains information on the HTTP response from the server.
	 * @return {Promise<void>} Resolves when the response has been sent.
	 */
	postEditStatusCompleted: function(req, res) {
		return completedHandler.handle(req, res);
	},

	/**
	 * Updates the status of the selected transaction to "Pending".
	 *
	 * @param {Express.Request} req  Object that contains information on the HTTP request from the client.
	 * @param {Express.Response} res  Object that contains information on the HTTP response from the server.
	 * @return {Promise<void>} Resolves when the response has been sent.
	 */
	postEditStatusPending: function(req, res) {
		return pendingHandler.handle(req, res);
	},

	/**
	 * Gets the page displaying more information for a particular transaction.
	 *
	 * @param {Express.Request} req  Object that contains information on the HTTP request from the client.
	 * @param {Express.Response} res  Object that contains information on the HTTP response from the server.
	 */
	getMoreInfoTransaction: function(req, res) {
		/* Retrieve the purchase ID from the page link. */
		const transactionId = req.params.id;

		/* Retrieve the data corresponding to the ID of the selected transaction. */
		const query = {id: transactionId};
		const projection = 'id status customer number date total priceDiscounted priceGasoline litersGasoline pricePremiumGasoline95 litersPremiumGasoline95 priceDiesel litersDiesel pricePremiumGasoline97 litersPremiumGasoline97 priceKerosene litersKerosene';

		db.findOne(Transaction, query, projection, function(result) {
			/* Format the display of the purchase date from the Date object
			 * stored in the database.
			 */
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

			const cleanDate = year + '-' + formattedMonth + '-' + formattedDate;

			/* Compute for the total price of each type of fuel purchased. */
			const totalGasoline = result.priceGasoline * result.litersGasoline;
			const totalPremiumGasoline95 = result.pricePremiumGasoline95 * result.litersPremiumGasoline95;
			const totalDiesel = result.priceDiesel * result.litersDiesel;
			const totalPremiumGasoline97 = result.pricePremiumGasoline97 * result.litersPremiumGasoline97;
			const totalKerosene = result.priceKerosene * result.litersKerosene;

			/* Store the purchase details in the variable data. */
			const data = {
				id: result.id,
				status: result.status,
				customer: result.customer,
				number: result.number,
				date: cleanDate,
				total: result.total,
				priceDiscounted: result.priceDiscounted,
				priceGasoline: result.priceGasoline,
				litersGasoline: result.litersGasoline,
				totalGasoline: totalGasoline,
				pricePremiumGasoline95: result.pricePremiumGasoline95,
				litersPremiumGasoline95: result.litersPremiumGasoline95,
				totalPremiumGasoline95: totalPremiumGasoline95,
				priceDiesel: result.priceDiesel,
				litersDiesel: result.litersDiesel,
				totalDiesel: totalDiesel,
				pricePremiumGasoline97: result.pricePremiumGasoline97,
				litersPremiumGasoline97: result.litersPremiumGasoline97,
				totalPremiumGasoline97: totalPremiumGasoline97,
				priceKerosene: result.priceKerosene,
				litersKerosene: result.litersKerosene,
				totalKerosene: totalKerosene
			};

			res.render('more-info-transaction', data);
		});
	},

	/**
	 * Gets the page for editing information for a particular transaction.
	 *
	 * @param {Express.Request} req  Object that contains information on the HTTP request from the client.
	 * @param {Express.Response} res  Object that contains information on the HTTP response from the server.
	 */
	getEditTransaction: function(req, res) {
		/* Retrieve the purchase ID from the page link. */
		const id = req.params.id;

		/* Retrieve the data corresponding to the ID of the selected transaction. */
		const query = {id: id};
		const projection = 'id status customer number date priceGasoline litersGasoline pricePremiumGasoline95 litersPremiumGasoline95 priceDiesel litersDiesel pricePremiumGasoline97 litersPremiumGasoline97 priceKerosene litersKerosene priceDiscounted';

		db.findOne(Transaction, query, projection, function(result) {
			/* Store the result of the database retrieval in the variable transactionDetails. */
			const transactionDetails = result;

			/* Format the display of the transaction date from the Date object
			 * stored in the database.
			 */
			const month = transactionDetails.date.getMonth() + 1;
			let formattedMonth = month;
			if (month.toString().length < 2) {
				formattedMonth = '0' + month.toString();
			}

			const date = transactionDetails.date.getDate();
			let formattedDate = date;
			if (date.toString().length < 2) {
				formattedDate = '0' + date.toString();
			}

			const year = transactionDetails.date.getFullYear();

			const cleanDate = year + '-' + formattedMonth + '-' + formattedDate;

			/* Store the total quantities and statuses of each type of fuel. */
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

				/* Store the transaction details and total fuel amounts in the variable data. */
				const data = {
					id: id,
					status: transactionDetails.status,
					customer: transactionDetails.customer,
					number: transactionDetails.number,
					date: cleanDate,
					priceGasoline: transactionDetails.priceGasoline,
					litersGasoline: transactionDetails.litersGasoline,
					pricePremiumGasoline95: transactionDetails.pricePremiumGasoline95,
					litersPremiumGasoline95: transactionDetails.litersPremiumGasoline95,
					priceDiesel: transactionDetails.priceDiesel,
					litersDiesel: transactionDetails.litersDiesel,
					pricePremiumGasoline97: transactionDetails.pricePremiumGasoline97,
					litersPremiumGasoline97: transactionDetails.litersPremiumGasoline97,
					priceKerosene: transactionDetails.priceKerosene,
					litersKerosene: transactionDetails.litersKerosene,
					priceDiscounted: transactionDetails.priceDiscounted,

					totalGasoline: totalGasoline,
					totalPremiumGasoline95: totalPremiumGasoline95,
					totalDiesel: totalDiesel,
					totalPremiumGasoline97: totalPremiumGasoline97,
					totalKerosene: totalKerosene
				};

				res.render('edit-transaction', data);
			});
		});
	},

	/**
	 * Edits a transaction in the database.
	 *
	 * @param {Express.Request} req  Object that contains information on the HTTP request from the client.
	 * @param {Express.Response} res  Object that contains information on the HTTP response from the server.
	 */
	postEditTransaction: function(req, res) {
		/* Retrieve the transaction details from the user input. */
		const transactionId = req.body.editTransactionId;
		const status = req.body.editTransactionStatus;
		const statusOrig = req.body.editTransactionStatusOld;
		const customer = req.body.editTransactionCustomerName.trim();
		const number = req.body.editTransactionCustomerNumber;
		const date = req.body.editTransactionDate;
		const priceGasoline = req.body.editTransactionGasolinePrice;
		const litersGasoline = req.body.editTransactionGasolineLiters;
		const litersGasolineOld = req.body.editTransactionGasolineLitersOld;
		const pricePremiumGasoline95 = req.body.editTransactionPremiumGasoline95Price;
		const litersPremiumGasoline95 = req.body.editTransactionPremiumGasoline95Liters;
		const litersPremiumGasoline95Old = req.body.editTransactionPremiumGasoline95LitersOld;
		const priceDiesel = req.body.editTransactionDieselPrice;
		const litersDiesel = req.body.editTransactionDieselLiters;
		const litersDieselOld = req.body.editTransactionDieselLitersOld;
		const pricePremiumGasoline97 = req.body.editTransactionPremiumGasoline97Price;
		const litersPremiumGasoline97 = req.body.editTransactionPremiumGasoline97Liters;
		const litersPremiumGasoline97Old = req.body.editTransactionPremiumGasoline97LitersOld;
		const priceKerosene = req.body.editTransactionKerosenePrice;
		const litersKerosene = req.body.editTransactionKeroseneLiters;
		const litersKeroseneOld = req.body.editTransactionKeroseneLitersOld;
		const priceDiscounted = req.body.editTransactionDiscount;

		/* Compute for the total cost of the transaction. */
		const total = (priceGasoline * litersGasoline) + (pricePremiumGasoline95 * litersPremiumGasoline95) +
					(priceDiesel * litersDiesel) + (pricePremiumGasoline97 * litersPremiumGasoline97) +
					(priceKerosene * litersKerosene);

		/* Update the database entry of the transaction. */
		const filter = {id: transactionId};

		/* Assign the transaction details to the variable update. */
		const update = {
			date: date,
			customer: customer,
			total: total,
			status: status,
			number: number,
			priceGasoline: priceGasoline,
			litersGasoline: litersGasoline,
			pricePremiumGasoline95: pricePremiumGasoline95,
			litersPremiumGasoline95: litersPremiumGasoline95,
			priceDiesel: priceDiesel,
			litersDiesel: litersDiesel,
			pricePremiumGasoline97: pricePremiumGasoline97,
			litersPremiumGasoline97: litersPremiumGasoline97,
			priceKerosene: priceKerosene,
			litersKerosene: litersKerosene,
			priceDiscounted: priceDiscounted
		};

		/* Update the transaction in the database. */
		db.updateOne(Transaction, filter, update, function(flag) {
			/* Store the stocks for each fuel type in a separate array to update their quantities. */
			const stocksGasoline = [];
			const stocksPremiumGasoline95 = [];
			const stocksDiesel = [];
			const stocksPremiumGasoline97 = [];
			const stocksKerosene = [];

			/* Retrieve the fuel types, purchase dates, and quantities of all inventory stocks. */
			const query = {};
			const projection = '_id type date quantityPurchased quantityDepleted';

			db.findMany(Inventory, query, projection, function(result) {
				/* Assign the result of the database retrieval to the variable purchases. */
				const purchases = result;

				/* For each purchase, store its details in its corresponding array according to fuel type. */
				for (let i = 0; i < purchases.length; i++) {
					if (purchases[i].type == 'gasoline') {
						stocksGasoline.push(purchases[i]);
					} else if (purchases[i].type == 'premium-gasoline-95') {
						stocksPremiumGasoline95.push(purchases[i]);
					} else if (purchases[i].type == 'diesel') {
						stocksDiesel.push(purchases[i]);
					} else if (purchases[i].type == 'premium-gasoline-97') {
						stocksPremiumGasoline97.push(purchases[i]);
					} else {
						stocksKerosene.push(purchases[i]);
					}
				}

				/* If the original status of the transaction is "Cancelled" and its current status is also
				 * "Cancelled", the stocks are not updated. Hence, only update the stocks if the current
				 * status of the transaction is "Pending" or "Completed".
				 */
				if (statusOrig == 'cancelled') {
					/* If the current status of the transaction is "Pending" or "Completed", subtract the
					 * ordered fuel amounts from the stocks.
					 */
					if (status == 'pending' || status == 'completed') {
						/* If the transaction involves a purchase of gasoline, arrange the stocks in
						 * chronological order and subtract the quantity purchased beginning from the
						 * earliest available stock.
						 */
						if (litersGasoline > 0) {
							/* If there are multiple stocks for the fuel type, arrange them in chronological order. */
							if (stocksGasoline.length >= 2) {
								stocksGasoline.sort(function(a, b) {
									const keyA = a.date;
									const keyB = b.date;

									if (keyA > keyB) {
										return 1;
									}
									if (keyA < keyB) {
										return -1;
									}
									return 0;
								});
							}

							/* Subtract fuel quantities from the stocks, starting from the oldest stock,
							 * until the quantity requested in the transaction has been reached.
							 */
							let transactionQuantity = litersGasoline;
							let i = 0;

							while (transactionQuantity > 0) {
								const availableStock = stocksGasoline[i].quantityPurchased - stocksGasoline[i].quantityDepleted;

								if (transactionQuantity >= availableStock) {
									transactionQuantity = transactionQuantity - availableStock;
									stocksGasoline[i].quantityDepleted = parseInt(stocksGasoline[i].quantityDepleted) + parseInt(availableStock);
								} else {
									stocksGasoline[i].quantityDepleted = parseInt(stocksGasoline[i].quantityDepleted) + parseInt(transactionQuantity);
									transactionQuantity = 0;
								}

								i++;
							}
						}

						/* If the transaction involves a purchase of Premium Gasoline 95, arrange the stocks in
						 * chronological order and subtract the quantity purchased beginning from the
						 * earliest available stock.
						 */
						if (litersPremiumGasoline95 > 0) {
							/* If there are multiple stocks for the fuel type, arrange them in chronological order. */
							if (stocksPremiumGasoline95.length >= 2) {
								stocksPremiumGasoline95.sort(function(a, b) {
									const keyA = a.date;
									const keyB = b.date;

									if (keyA > keyB) {
										return 1;
									}
									if (keyA < keyB) {
										return -1;
									}
									return 0;
								});
							}

							/* Subtract fuel quantities from the stocks, starting from the oldest stock,
							 * until the quantity requested in the transaction has been reached.
							 */
							let transactionQuantity = litersPremiumGasoline95;
							let i = 0;

							while (transactionQuantity > 0) {
								const availableStock = stocksPremiumGasoline95[i].quantityPurchased - stocksPremiumGasoline95[i].quantityDepleted;

								if (transactionQuantity >= availableStock) {
									transactionQuantity = transactionQuantity - availableStock;
									stocksPremiumGasoline95[i].quantityDepleted = parseInt(stocksPremiumGasoline95[i].quantityDepleted) + parseInt(availableStock);
								} else {
									stocksPremiumGasoline95[i].quantityDepleted = parseInt(stocksPremiumGasoline95[i].quantityDepleted) + parseInt(transactionQuantity);
									transactionQuantity = 0;
								}

								i++;
							}
						}


						/* If the transaction involves a purchase of diesel, arrange the stocks in
						 * chronological order and subtract the quantity purchased beginning from the
						 * earliest available stock.
						 */
						if (litersDiesel > 0) {
							/* If there are multiple stocks for the fuel type, arrange them in chronological order. */
							if (stocksDiesel.length >= 2) {
								stocksDiesel.sort(function(a, b) {
									const keyA = a.date;
									const keyB = b.date;

									if (keyA > keyB) {
										return 1;
									}
									if (keyA < keyB) {
										return -1;
									}
									return 0;
								});
							}

							/* Subtract fuel quantities from the stocks, starting from the oldest stock,
							 * until the quantity requested in the transaction has been reached.
							 */
							let transactionQuantity = litersDiesel;
							let i = 0;

							while (transactionQuantity > 0) {
								const availableStock = stocksDiesel[i].quantityPurchased - stocksDiesel[i].quantityDepleted;

								if (transactionQuantity >= availableStock) {
									transactionQuantity = transactionQuantity - availableStock;
									stocksDiesel[i].quantityDepleted = parseInt(stocksDiesel[i].quantityDepleted) + parseInt(availableStock);
								} else {
									stocksDiesel[i].quantityDepleted = parseInt(stocksDiesel[i].quantityDepleted) + parseInt(transactionQuantity);
									transactionQuantity = 0;
								}

								i++;
							}
						}


						/* If the transaction involves a purchase of Premium Gasoline 97, arrange the stocks in
						 * chronological order and subtract the quantity purchased beginning from the
						 * earliest available stock.
						 */
						if (litersPremiumGasoline97 > 0) {
							/* If there are multiple stocks for the fuel type, arrange them in chronological order. */
							if (stocksPremiumGasoline97.length >= 2) {
								stocksPremiumGasoline97.sort(function(a, b) {
									const keyA = a.date;
									const keyB = b.date;

									if (keyA > keyB) {
										return 1;
									}
									if (keyA < keyB) {
										return -1;
									}
									return 0;
								});
							}

							/* Subtract fuel quantities from the stocks, starting from the oldest stock,
							 * until the quantity requested in the transaction has been reached.
							 */
							let transactionQuantity = litersPremiumGasoline97;
							let i = 0;

							while (transactionQuantity > 0) {
								const availableStock = stocksPremiumGasoline97[i].quantityPurchased - stocksPremiumGasoline97[i].quantityDepleted;

								if (transactionQuantity >= availableStock) {
									transactionQuantity = transactionQuantity - availableStock;
									stocksPremiumGasoline97[i].quantityDepleted = parseInt(stocksPremiumGasoline97[i].quantityDepleted) + parseInt(availableStock);
								} else {
									stocksPremiumGasoline97[i].quantityDepleted = parseInt(stocksPremiumGasoline97[i].quantityDepleted) + parseInt(transactionQuantity);
									transactionQuantity = 0;
								}

								i++;
							}
						}


						/* If the transaction involves a purchase of kerosene, arrange the stocks in
						 * chronological order and subtract the quantity purchased beginning from the
						 * earliest available stock.
						 */
						if (litersKerosene > 0) {
							/* If there are multiple stocks for the fuel type, arrange them in chronological order. */
							if (stocksKerosene.length >= 2) {
								stocksKerosene.sort(function(a, b) {
									const keyA = a.date;
									const keyB = b.date;

									if (keyA > keyB) {
										return 1;
									}
									if (keyA < keyB) {
										return -1;
									}
									return 0;
								});
							}

							/* Subtract fuel quantities from the stocks, starting from the oldest stock,
							 * until the quantity requested in the transaction has been reached.
							 */
							let transactionQuantity = litersKerosene;
							let i = 0;

							while (transactionQuantity > 0) {
								const availableStock = stocksKerosene[i].quantityPurchased - stocksKerosene[i].quantityDepleted;

								if (transactionQuantity >= availableStock) {
									transactionQuantity = transactionQuantity - availableStock;
									stocksKerosene[i].quantityDepleted = parseInt(stocksKerosene[i].quantityDepleted) + parseInt(availableStock);
								} else {
									stocksKerosene[i].quantityDepleted = parseInt(stocksKerosene[i].quantityDepleted) + parseInt(transactionQuantity);
									transactionQuantity = 0;
								}

								i++;
							}
						}
					}

				/* If the original status of the transaction is "Pending", handle the inventory updates accordingly. */
				} else {
					/* If the current status of the transaction is "Cancelled", return the fuel amounts originally
					 * ordered in the transaction to their respective stocks for reallocation to other transactions.
					 */
					if (status == 'cancelled') {
						/* If the transaction originally involves a purchase of gasoline, arrange the stocks in
						 * chronological order and return the quantity purchased beginning from the
						 * latest stock, as the inventory is consumed via the FIFO method.
						 */
						if (litersGasolineOld > 0) {
							/* If there are multiple stocks for the fuel type, arrange them in chronological order. */
							if (stocksGasoline.length >= 2) {
								stocksGasoline.sort(function(a, b) {
									const keyA = a.date;
									const keyB = b.date;

									if (keyA > keyB) {
										return 1;
									}
									if (keyA < keyB) {
										return -1;
									}
									return 0;
								});
							}

							/* Return fuel quantities to the stocks, starting from the latest stock,
							 * until the original quantity requested in the transaction has been depleted.
							 */
							let transactionQuantity = litersGasolineOld;
							let i = stocksGasoline.length - 1;

							while (transactionQuantity > 0) {
								const depletedStock = stocksGasoline[i].quantityDepleted;

								if (transactionQuantity >= depletedStock) {
									transactionQuantity = transactionQuantity - depletedStock;
									stocksGasoline[i].quantityDepleted = 0;
								} else {
									stocksGasoline[i].quantityDepleted = parseInt(stocksGasoline[i].quantityDepleted) - parseInt(transactionQuantity);
									transactionQuantity = 0;
								}

								i--;
							}
						}


						/* If the transaction originally involves a purchase of Premium Gasoline 95, arrange the stocks in
						 * chronological order and return the quantity purchased beginning from the
						 * latest stock, as the inventory is consumed via the FIFO method.
						 */
						if (litersPremiumGasoline95Old > 0) {
							/* If there are multiple stocks for the fuel type, arrange them in chronological order. */
							if (stocksPremiumGasoline95.length >= 2) {
								stocksPremiumGasoline95.sort(function(a, b) {
									const keyA = a.date;
									const keyB = b.date;

									if (keyA > keyB) {
										return 1;
									}
									if (keyA < keyB) {
										return -1;
									}
									return 0;
								});
							}

							/* Return fuel quantities to the stocks, starting from the latest stock,
							 * until the original quantity requested in the transaction has been depleted.
							 */
							let transactionQuantity = litersPremiumGasoline95Old;
							let i = stocksPremiumGasoline95.length - 1;

							while (transactionQuantity > 0) {
								const depletedStock = stocksPremiumGasoline95[i].quantityDepleted;

								if (transactionQuantity >= depletedStock) {
									transactionQuantity = transactionQuantity - depletedStock;
									stocksPremiumGasoline95[i].quantityDepleted = 0;
								} else {
									stocksPremiumGasoline95[i].quantityDepleted = parseInt(stocksPremiumGasoline95[i].quantityDepleted) - parseInt(transactionQuantity);
									transactionQuantity = 0;
								}

								i--;
							}
						}


						/* If the transaction originally involves a purchase of diesel, arrange the stocks in
						 * chronological order and return the quantity purchased beginning from the
						 * latest stock, as the inventory is consumed via the FIFO method.
						 */
						if (litersDieselOld > 0) {
							/* If there are multiple stocks for the fuel type, arrange them in chronological order. */
							if (stocksDiesel.length >= 2) {
								stocksDiesel.sort(function(a, b) {
									const keyA = a.date;
									const keyB = b.date;

									if (keyA > keyB) {
										return 1;
									}
									if (keyA < keyB) {
										return -1;
									}
									return 0;
								});
							}

							/* Return fuel quantities to the stocks, starting from the latest stock,
							 * until the original quantity requested in the transaction has been depleted.
							 */
							let transactionQuantity = litersDieselOld;
							let i = stocksDiesel.length - 1;

							while (transactionQuantity > 0) {
								const depletedStock = stocksDiesel[i].quantityDepleted;

								if (transactionQuantity >= depletedStock) {
									transactionQuantity = transactionQuantity - depletedStock;
									stocksDiesel[i].quantityDepleted = 0;
								} else {
									stocksDiesel[i].quantityDepleted = parseInt(stocksDiesel[i].quantityDepleted) - parseInt(transactionQuantity);
									transactionQuantity = 0;
								}

								i--;
							}
						}


						/* If the transaction originally involves a purchase of Premium Gasoline 97, arrange the stocks in
						 * chronological order and return the quantity purchased beginning from the
						 * latest stock, as the inventory is consumed via the FIFO method.
						 */
						if (litersPremiumGasoline97Old > 0) {
							/* If there are multiple stocks for the fuel type, arrange them in chronological order. */
							if (stocksPremiumGasoline97.length >= 2) {
								stocksPremiumGasoline97.sort(function(a, b) {
									const keyA = a.date;
									const keyB = b.date;

									if (keyA > keyB) {
										return 1;
									}
									if (keyA < keyB) {
										return -1;
									}
									return 0;
								});
							}

							/* Return fuel quantities to the stocks, starting from the latest stock,
							 * until the original quantity requested in the transaction has been depleted.
							 */
							let transactionQuantity = litersPremiumGasoline97Old;
							let i = stocksPremiumGasoline97.length - 1;

							while (transactionQuantity > 0) {
								const depletedStock = stocksPremiumGasoline97[i].quantityDepleted;

								if (transactionQuantity >= depletedStock) {
									transactionQuantity = transactionQuantity - depletedStock;
									stocksPremiumGasoline97[i].quantityDepleted = 0;
								} else {
									stocksPremiumGasoline97[i].quantityDepleted = parseInt(stocksPremiumGasoline97[i].quantityDepleted) - parseInt(transactionQuantity);
									transactionQuantity = 0;
								}

								i--;
							}
						}


						/* If the transaction originally involves a purchase of kerosene, arrange the stocks in
						 * chronological order and return the quantity purchased beginning from the
						 * latest stock, as the inventory is consumed via the FIFO method.
						 */
						if (litersKeroseneOld > 0) {
							/* If there are multiple stocks for the fuel type, arrange them in chronological order. */
							if (stocksKerosene.length >= 2) {
								stocksKerosene.sort(function(a, b) {
									const keyA = a.date;
									const keyB = b.date;

									if (keyA > keyB) {
										return 1;
									}
									if (keyA < keyB) {
										return -1;
									}
									return 0;
								});
							}

							/* Return fuel quantities to the stocks, starting from the latest stock,
							 * until the original quantity requested in the transaction has been depleted.
							 */
							let transactionQuantity = litersKeroseneOld;
							let i = stocksKerosene.length - 1;

							while (transactionQuantity > 0) {
								const depletedStock = stocksKerosene[i].quantityDepleted;

								if (transactionQuantity >= depletedStock) {
									transactionQuantity = transactionQuantity - depletedStock;
									stocksKerosene[i].quantityDepleted = 0;
								} else {
									stocksKerosene[i].quantityDepleted = parseInt(stocksKerosene[i].quantityDepleted) - parseInt(transactionQuantity);
									transactionQuantity = 0;
								}

								i--;
							}
						}

					/* If the current status of the transaction is "Pending" or "Completed", update the stocks based
					 * on the difference between the original and the current fuel amounts purchased in the transaction.
					 */
					} else {
						/* If the transaction involves difference in the amount of gasoline purchased,
						 * arrange the stocks in chronological order and update them accordingly.
						 */
						if (litersGasoline - litersGasolineOld != 0) {
							/* If there are multiple stocks for the fuel type, arrange them in chronological order. */
							if (stocksGasoline.length >= 2) {
								stocksGasoline.sort(function(a, b) {
									const keyA = a.date;
									const keyB = b.date;

									if (keyA > keyB) {
										return 1;
									}
									if (keyA < keyB) {
										return -1;
									}
									return 0;
								});
							}

							/* If the current amount of fuel purchased is greater than the original
							 * amount, subtract fuel quantities from the stocks, starting from the
							 * oldest stock, until the difference has been reached.
							 */
							if (litersGasoline > litersGasolineOld) {
								let transactionQuantity = litersGasoline - litersGasolineOld;
								let i = 0;

								while (transactionQuantity > 0) {
									const availableStock = stocksGasoline[i].quantityPurchased - stocksGasoline[i].quantityDepleted;

									if (transactionQuantity >= availableStock) {
										transactionQuantity = transactionQuantity - availableStock;
										stocksGasoline[i].quantityDepleted = parseInt(stocksGasoline[i].quantityDepleted) + parseInt(availableStock);
									} else {
										stocksGasoline[i].quantityDepleted = parseInt(stocksGasoline[i].quantityDepleted) + parseInt(transactionQuantity);
										transactionQuantity = 0;
									}

									i++;
								}

							/* Otherwise, if the current amount of fuel purchased is less than the original
							 * amount, return fuel quantities to the stocks, starting from the latest stock,
							 * until the difference has been depleted.
							 */
							} else if (litersGasoline < litersGasolineOld) {
								let transactionQuantity = litersGasolineOld - litersGasoline;
								let i = stocksGasoline.length - 1;

								while (transactionQuantity > 0) {
									const depletedStock = stocksGasoline[i].quantityDepleted;

									if (transactionQuantity >= depletedStock) {
										transactionQuantity = transactionQuantity - depletedStock;
										stocksGasoline[i].quantityDepleted = 0;
									} else {
										stocksGasoline[i].quantityDepleted = parseInt(stocksGasoline[i].quantityDepleted) - parseInt(transactionQuantity);
										transactionQuantity = 0;
									}

									i--;
								}
							}
						}


						/* If the transaction involves difference in the amount of Premium Gasoline 95 purchased,
						 * arrange the stocks in chronological order and update them accordingly.
						 */
						if (litersPremiumGasoline95 - litersPremiumGasoline95Old != 0) {
							/* If there are multiple stocks for the fuel type, arrange them in chronological order. */
							if (stocksPremiumGasoline95.length >= 2) {
								stocksPremiumGasoline95.sort(function(a, b) {
									const keyA = a.date;
									const keyB = b.date;

									if (keyA > keyB) {
										return 1;
									}
									if (keyA < keyB) {
										return -1;
									}
									return 0;
								});
							}

							/* If the current amount of fuel purchased is greater than the original
							 * amount, subtract fuel quantities from the stocks, starting from the
							 * oldest stock, until the difference has been reached.
							 */
							if (litersPremiumGasoline95 > litersPremiumGasoline95Old) {
								let transactionQuantity = litersPremiumGasoline95 - litersPremiumGasoline95Old;
								let i = 0;

								while (transactionQuantity > 0) {
									const availableStock = stocksPremiumGasoline95[i].quantityPurchased - stocksPremiumGasoline95[i].quantityDepleted;

									if (transactionQuantity >= availableStock) {
										transactionQuantity = transactionQuantity - availableStock;
										stocksPremiumGasoline95[i].quantityDepleted = parseInt(stocksPremiumGasoline95[i].quantityDepleted) + parseInt(availableStock);
									} else {
										stocksPremiumGasoline95[i].quantityDepleted = parseInt(stocksPremiumGasoline95[i].quantityDepleted) + parseInt(transactionQuantity);
										transactionQuantity = 0;
									}

									i++;
								}

							/* Otherwise, if the current amount of fuel purchased is less than the original
							 * amount, return fuel quantities to the stocks, starting from the latest stock,
							 * until the difference has been depleted.
							 */
							} else if (litersPremiumGasoline95 < litersPremiumGasoline95Old) {
								let transactionQuantity = litersPremiumGasoline95Old - litersPremiumGasoline95;
								let i = stocksPremiumGasoline95.length - 1;

								while (transactionQuantity > 0) {
									const depletedStock = stocksPremiumGasoline95[i].quantityDepleted;

									if (transactionQuantity >= depletedStock) {
										transactionQuantity = transactionQuantity - depletedStock;
										stocksPremiumGasoline95[i].quantityDepleted = 0;
									} else {
										stocksPremiumGasoline95[i].quantityDepleted = parseInt(stocksPremiumGasoline95[i].quantityDepleted) - parseInt(transactionQuantity);
										transactionQuantity = 0;
									}

									i--;
								}
							}
						}


						/* If the transaction involves difference in the amount of diesel purchased,
						 * arrange the stocks in chronological order and update them accordingly.
						 */
						if (litersDiesel - litersDieselOld != 0) {
							/* If there are multiple stocks for the fuel type, arrange them in chronological order. */
							if (stocksDiesel.length >= 2) {
								stocksDiesel.sort(function(a, b) {
									const keyA = a.date;
									const keyB = b.date;

									if (keyA > keyB) {
										return 1;
									}
									if (keyA < keyB) {
										return -1;
									}
									return 0;
								});
							}

							/* If the current amount of fuel purchased is greater than the original
							 * amount, subtract fuel quantities from the stocks, starting from the
							 * oldest stock, until the difference has been reached.
							 */
							if (litersDiesel > litersDieselOld) {
								let transactionQuantity = litersDiesel - litersDieselOld;
								let i = 0;

								while (transactionQuantity > 0) {
									const availableStock = stocksDiesel[i].quantityPurchased - stocksDiesel[i].quantityDepleted;

									if (transactionQuantity >= availableStock) {
										transactionQuantity = transactionQuantity - availableStock;
										stocksDiesel[i].quantityDepleted = parseInt(stocksDiesel[i].quantityDepleted) + parseInt(availableStock);
									} else {
										stocksDiesel[i].quantityDepleted = parseInt(stocksDiesel[i].quantityDepleted) + parseInt(transactionQuantity);
										transactionQuantity = 0;
									}

									i++;
								}

							/* Otherwise, if the current amount of fuel purchased is less than the original
							 * amount, return fuel quantities to the stocks, starting from the latest stock,
							 * until the difference has been depleted.
							 */
							} else if (litersDiesel < litersDieselOld) {
								let transactionQuantity = litersDieselOld - litersDiesel;
								let i = stocksDiesel.length - 1;

								while (transactionQuantity > 0) {
									const depletedStock = stocksDiesel[i].quantityDepleted;

									if (transactionQuantity >= depletedStock) {
										transactionQuantity = transactionQuantity - depletedStock;
										stocksDiesel[i].quantityDepleted = 0;
									} else {
										stocksDiesel[i].quantityDepleted = parseInt(stocksDiesel[i].quantityDepleted) - parseInt(transactionQuantity);
										transactionQuantity = 0;
									}

									i--;
								}
							}
						}


						/* If the transaction involves difference in the amount of Premium Gasoline 97 purchased,
						 * arrange the stocks in chronological order and update them accordingly.
						 */
						if (litersPremiumGasoline97 - litersPremiumGasoline97Old != 0) {
							/* If there are multiple stocks for the fuel type, arrange them in chronological order. */
							if (stocksPremiumGasoline97.length >= 2) {
								stocksPremiumGasoline97.sort(function(a, b) {
									const keyA = a.date;
									const keyB = b.date;

									if (keyA > keyB) {
										return 1;
									}
									if (keyA < keyB) {
										return -1;
									}
									return 0;
								});
							}

							/* If the current amount of fuel purchased is greater than the original
							 * amount, subtract fuel quantities from the stocks, starting from the
							 * oldest stock, until the difference has been reached.
							 */
							if (litersPremiumGasoline97 > litersPremiumGasoline97Old) {
								let transactionQuantity = litersPremiumGasoline97 - litersPremiumGasoline97Old;
								let i = 0;

								while (transactionQuantity > 0) {
									const availableStock = stocksPremiumGasoline97[i].quantityPurchased - stocksPremiumGasoline97[i].quantityDepleted;

									if (transactionQuantity >= availableStock) {
										transactionQuantity = transactionQuantity - availableStock;
										stocksPremiumGasoline97[i].quantityDepleted = parseInt(stocksPremiumGasoline97[i].quantityDepleted) + parseInt(availableStock);
									} else {
										stocksPremiumGasoline97[i].quantityDepleted = parseInt(stocksPremiumGasoline97[i].quantityDepleted) + parseInt(transactionQuantity);
										transactionQuantity = 0;
									}

									i++;
								}

							/* Otherwise, if the current amount of fuel purchased is less than the original
							 * amount, return fuel quantities to the stocks, starting from the latest stock,
							 * until the difference has been depleted.
							 */
							} else if (litersPremiumGasoline97 < litersPremiumGasoline97Old) {
								let transactionQuantity = litersPremiumGasoline97Old - litersPremiumGasoline97;
								let i = stocksPremiumGasoline97.length - 1;

								while (transactionQuantity > 0) {
									const depletedStock = stocksPremiumGasoline97[i].quantityDepleted;

									if (transactionQuantity >= depletedStock) {
										transactionQuantity = transactionQuantity - depletedStock;
										stocksPremiumGasoline97[i].quantityDepleted = 0;
									} else {
										stocksPremiumGasoline97[i].quantityDepleted = parseInt(stocksPremiumGasoline97[i].quantityDepleted) - parseInt(transactionQuantity);
										transactionQuantity = 0;
									}

									i--;
								}
							}
						}


						/* If the transaction involves difference in the amount of kerosene purchased,
						 * arrange the stocks in chronological order and update them accordingly.
						 */
						if (litersKerosene - litersKeroseneOld != 0) {
							/* If there are multiple stocks for the fuel type, arrange them in chronological order. */
							if (stocksKerosene.length >= 2) {
								stocksKerosene.sort(function(a, b) {
									const keyA = a.date;
									const keyB = b.date;

									if (keyA > keyB) {
										return 1;
									}
									if (keyA < keyB) {
										return -1;
									}
									return 0;
								});
							}

							/* If the current amount of fuel purchased is greater than the original
							 * amount, subtract fuel quantities from the stocks, starting from the
							 * oldest stock, until the difference has been reached.
							 */
							if (litersKerosene > litersKeroseneOld) {
								let transactionQuantity = litersKerosene - litersKeroseneOld;
								let i = 0;

								while (transactionQuantity > 0) {
									const availableStock = stocksKerosene[i].quantityPurchased - stocksKerosene[i].quantityDepleted;

									if (transactionQuantity >= availableStock) {
										transactionQuantity = transactionQuantity - availableStock;
										stocksKerosene[i].quantityDepleted = parseInt(stocksKerosene[i].quantityDepleted) + parseInt(availableStock);
									} else {
										stocksKerosene[i].quantityDepleted = parseInt(stocksKerosene[i].quantityDepleted) + parseInt(transactionQuantity);
										transactionQuantity = 0;
									}

									i++;
								}

							/* Otherwise, if the current amount of fuel purchased is less than the original
							 * amount, return fuel quantities to the stocks, starting from the latest stock,
							 * until the difference has been depleted.
							 */
							} else if (litersKerosene < litersKeroseneOld) {
								let transactionQuantity = litersKeroseneOld - litersKerosene;
								let i = stocksKerosene.length - 1;

								while (transactionQuantity > 0) {
									const depletedStock = stocksKerosene[i].quantityDepleted;

									if (transactionQuantity >= depletedStock) {
										transactionQuantity = transactionQuantity - depletedStock;
										stocksKerosene[i].quantityDepleted = 0;
									} else {
										stocksKerosene[i].quantityDepleted = parseInt(stocksKerosene[i].quantityDepleted) - parseInt(transactionQuantity);
										transactionQuantity = 0;
									}

									i--;
								}
							}
						}
					}
				}

				/* Update the quantities depleted of the gasoline stocks. */
				for (i = 0; i < stocksGasoline.length; i++) {
					const filter = {_id: stocksGasoline[i]._id};
					const update = {
						quantityDepleted: stocksGasoline[i].quantityDepleted
					};

					db.updateOneIterative(Inventory, filter, update);
				}

				/* Update the quantities depleted of the Premium Gasoline 95 stocks. */
				for (i = 0; i < stocksPremiumGasoline95.length; i++) {
					const filter = {_id: stocksPremiumGasoline95[i]._id};
					const update = {
						quantityDepleted: stocksPremiumGasoline95[i].quantityDepleted
					};

					db.updateOneIterative(Inventory, filter, update);
				}

				/* Update the quantities depleted of the diesel stocks. */
				for (i = 0; i < stocksDiesel.length; i++) {
					const filter = {_id: stocksDiesel[i]._id};
					const update = {
						quantityDepleted: stocksDiesel[i].quantityDepleted
					};

					db.updateOneIterative(Inventory, filter, update);
				}

				/* Update the quantities depleted of the Premium Gasoline 97 stocks. */
				for (i = 0; i < stocksPremiumGasoline97.length; i++) {
					const filter = {_id: stocksPremiumGasoline97[i]._id};
					const update = {
						quantityDepleted: stocksPremiumGasoline97[i].quantityDepleted
					};

					db.updateOneIterative(Inventory, filter, update);
				}

				/* Update the quantities depleted of the kerosene stocks. */
				for (i = 0; i < stocksKerosene.length; i++) {
					const filter = {_id: stocksKerosene[i]._id};
					const update = {
						quantityDepleted: stocksKerosene[i].quantityDepleted
					};

					db.updateOneIterative(Inventory, filter, update);
				}

				/* The delivery ID corresponding to a transaction has a starting digit of 2 and the same
				 * succeeding digits as the transaction ID.
				 */
				const deliveryId = parseInt(transactionId) + 10000000;

				/* Set the status of the selected delivery to the status of its corresponding transaction. */
				const updateDelivery = {status: status};

				/* Use the delivery ID for database retrieval. */
				const filterDelivery = {id: deliveryId};

				/* Update the status of the delivery. */
				db.updateOne(Delivery, filterDelivery, updateDelivery, function(flag) {
					res.status(200).json('Delivery status updated successfully!');
					res.send();
				});
			});
		});
	},

	/**
	 * Gets the page for adding a new transaction.
	 *
	 * @param {Express.Request} req  Object that contains information on the HTTP request from the client.
	 * @param {Express.Response} res  Object that contains information on the HTTP response from the server.
	 */
	getAddTransaction: function(req, res) {
		/* Retrieve the transaction number of the new transaction. */
		const query = {label: 'nextTransaction'};
		const projection = 'transactionNumber';

		db.findOne(TransactionNumber, query, projection, function(result) {
			/* Store the retrieved transaction number in the variable transactionId. */
			const transactionId = result.transactionNumber;

			/* Retrieve the current selling price of each fuel type. */
			const queryPrice = {label: 'Prices'};
			const projectionPrice = 'gasoline premiumGasoline95 diesel premiumGasoline97 kerosene';

			db.findOne(Price, queryPrice, projectionPrice, function(result) {
				/* Store the result of the database retrieval in the variable sellingPrices. */
				const sellingPrices = result;

				/* Store the total quantities and statuses of each type of fuel. */
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

					/* Store the preliminary transaction data in the variable data. */
					const data = {
						id: transactionId,
						priceGasoline: sellingPrices.gasoline,
						pricePremiumGasoline95: sellingPrices.premiumGasoline95,
						priceDiesel: sellingPrices.diesel,
						pricePremiumGasoline97: sellingPrices.premiumGasoline97,
						priceKerosene: sellingPrices.kerosene,

						totalGasoline: totalGasoline,
						totalPremiumGasoline95: totalPremiumGasoline95,
						totalDiesel: totalDiesel,
						totalPremiumGasoline97: totalPremiumGasoline97,
						totalKerosene: totalKerosene
					};

					res.render('add-transaction', data);
				});
			});
		});
	},

	/**
	 * Adds a new transaction to the database.
	 *
	 * @param {Express.Request} req  Object that contains information on the HTTP request from the client.
	 * @param {Express.Response} res  Object that contains information on the HTTP response from the server.
	 */
	postAddTransaction: function(req, res) {
		/* Retrieve the transaction details from the user input. */
		const transactionId = req.body.addTransactionId;
		const customer = req.body.addTransactionCustomerName.trim();
		const number = req.body.addTransactionCustomerNumber;
		const date = req.body.addTransactionDate;
		const priceGasoline = req.body.addTransactionGasolinePrice;
		const litersGasoline = req.body.addTransactionGasolineLiters;
		const pricePremiumGasoline95 = req.body.addTransactionPremiumGasoline95Price;
		const litersPremiumGasoline95 = req.body.addTransactionPremiumGasoline95Liters;
		const priceDiesel = req.body.addTransactionDieselPrice;
		const litersDiesel = req.body.addTransactionDieselLiters;
		const pricePremiumGasoline97 = req.body.addTransactionPremiumGasoline97Price;
		const litersPremiumGasoline97 = req.body.addTransactionPremiumGasoline97Liters;
		const priceKerosene = req.body.addTransactionKerosenePrice;
		const litersKerosene = req.body.addTransactionKeroseneLiters;
		const discountAmount = req.body.addTransactionDiscount;

		/* Compute for the total cost of the transaction. */
		const total = (priceGasoline * litersGasoline) + (pricePremiumGasoline95 * litersPremiumGasoline95) +
					(priceDiesel * litersDiesel) + (pricePremiumGasoline97 * litersPremiumGasoline97) +
					(priceKerosene * litersKerosene);

		/* Assign the transaction details to the variable transaction. */
		const transaction = {
			id: transactionId,
			date: date,
			customer: customer,
			total: total,
			status: 'pending',
			number: number,
			priceGasoline: priceGasoline,
			litersGasoline: litersGasoline,
			pricePremiumGasoline95: pricePremiumGasoline95,
			litersPremiumGasoline95: litersPremiumGasoline95,
			priceDiesel: priceDiesel,
			litersDiesel: litersDiesel,
			pricePremiumGasoline97: pricePremiumGasoline97,
			litersPremiumGasoline97: litersPremiumGasoline97,
			priceKerosene: priceKerosene,
			litersKerosene: litersKerosene,
			priceDiscounted: discountAmount
		};

		/* Add the new transaction to the database. */
		db.insertOne(Transaction, transaction, function(flag) {
			/* Store the stocks for each fuel type in a separate array to update their quantities. */
			const stocksGasoline = [];
			const stocksPremiumGasoline95 = [];
			const stocksDiesel = [];
			const stocksPremiumGasoline97 = [];
			const stocksKerosene = [];

			/* Retrieve the fuel types, purchase dates, and quantities of all inventory stocks. */
			const query = {};
			const projection = '_id type date quantityPurchased quantityDepleted';

			db.findMany(Inventory, query, projection, function(result) {
				/* Assign the result of the database retrieval to the variable purchases. */
				const purchases = result;

				/* For each purchase, store its details in its corresponding array according to fuel type. */
				for (let i = 0; i < purchases.length; i++) {
					if (purchases[i].type == 'gasoline') {
						stocksGasoline.push(purchases[i]);
					} else if (purchases[i].type == 'premium-gasoline-95') {
						stocksPremiumGasoline95.push(purchases[i]);
					} else if (purchases[i].type == 'diesel') {
						stocksDiesel.push(purchases[i]);
					} else if (purchases[i].type == 'premium-gasoline-97') {
						stocksPremiumGasoline97.push(purchases[i]);
					} else {
						stocksKerosene.push(purchases[i]);
					}
				}

				/* If the transaction involves a purchase of gasoline, arrange the stocks in
				 * chronological order and subtract the quantity purchased beginning from the
				 * earliest available stock. */
				if (litersGasoline > 0) {
					/* If there are multiple stocks for the fuel type, arrange them in chronological order. */
					if (stocksGasoline.length >= 2) {
						stocksGasoline.sort(function(a, b) {
							const keyA = a.date;
							const keyB = b.date;

							if (keyA > keyB) {
								return 1;
							}
							if (keyA < keyB) {
								return -1;
							}
							return 0;
						});
					}

					/* Subtract fuel quantities from the stocks, starting from the oldest stock,
					 * until the quantity requested in the transaction has been reached.
					 */
					let transactionQuantity = litersGasoline;
					let i = 0;

					while (transactionQuantity > 0) {
						const availableStock = stocksGasoline[i].quantityPurchased - stocksGasoline[i].quantityDepleted;

						if (transactionQuantity >= availableStock) {
							transactionQuantity = transactionQuantity - availableStock;
							stocksGasoline[i].quantityDepleted = parseInt(stocksGasoline[i].quantityDepleted) + parseInt(availableStock);
						} else {
							stocksGasoline[i].quantityDepleted = parseInt(stocksGasoline[i].quantityDepleted) + parseInt(transactionQuantity);
							transactionQuantity = 0;
						}

						i++;
					}
				}


				/* If the transaction involves a purchase of Premium Gasoline 95, arrange the stocks in
				 * chronological order and subtract the quantity purchased beginning from the
				 * earliest available stock. */
				if (litersPremiumGasoline95 > 0) {
					/* If there are multiple stocks for the fuel type, arrange them in chronological order. */
					if (stocksPremiumGasoline95.length >= 2) {
						stocksPremiumGasoline95.sort(function(a, b) {
							const keyA = a.date;
							const keyB = b.date;

							if (keyA > keyB) {
								return 1;
							}
							if (keyA < keyB) {
								return -1;
							}
							return 0;
						});
					}

					/* Subtract fuel quantities from the stocks, starting from the oldest stock,
					 * until the quantity requested in the transaction has been reached.
					 */
					let transactionQuantity = litersPremiumGasoline95;
					let i = 0;

					while (transactionQuantity > 0) {
						const availableStock = stocksPremiumGasoline95[i].quantityPurchased - stocksPremiumGasoline95[i].quantityDepleted;

						if (transactionQuantity >= availableStock) {
							transactionQuantity = transactionQuantity - availableStock;
							stocksPremiumGasoline95[i].quantityDepleted = parseInt(stocksPremiumGasoline95[i].quantityDepleted) + parseInt(availableStock);
						} else {
							stocksPremiumGasoline95[i].quantityDepleted = parseInt(stocksPremiumGasoline95[i].quantityDepleted) + parseInt(transactionQuantity);
							transactionQuantity = 0;
						}

						i++;
					}
				}


				/* If the transaction involves a purchase of diesel, arrange the stocks in
				 * chronological order and subtract the quantity purchased beginning from the
				 * earliest available stock. */
				if (litersDiesel > 0) {
					/* If there are multiple stocks for the fuel type, arrange them in chronological order. */
					if (stocksDiesel.length >= 2) {
						stocksDiesel.sort(function(a, b) {
							const keyA = a.date;
							const keyB = b.date;

							if (keyA > keyB) {
								return 1;
							}
							if (keyA < keyB) {
								return -1;
							}
							return 0;
						});
					}

					/* Subtract fuel quantities from the stocks, starting from the oldest stock,
					 * until the quantity requested in the transaction has been reached.
					 */
					let transactionQuantity = litersDiesel;
					let i = 0;

					while (transactionQuantity > 0) {
						const availableStock = stocksDiesel[i].quantityPurchased - stocksDiesel[i].quantityDepleted;

						if (transactionQuantity >= availableStock) {
							transactionQuantity = transactionQuantity - availableStock;
							stocksDiesel[i].quantityDepleted = parseInt(stocksDiesel[i].quantityDepleted) + parseInt(availableStock);
						} else {
							stocksDiesel[i].quantityDepleted = parseInt(stocksDiesel[i].quantityDepleted) + parseInt(transactionQuantity);
							transactionQuantity = 0;
						}

						i++;
					}
				}


				/* If the transaction involves a purchase of Premium Gasoline 97, arrange the stocks in
				 * chronological order and subtract the quantity purchased beginning from the
				 * earliest available stock. */
				if (litersPremiumGasoline97 > 0) {
					/* If there are multiple stocks for the fuel type, arrange them in chronological order. */
					if (stocksPremiumGasoline97.length >= 2) {
						stocksPremiumGasoline97.sort(function(a, b) {
							const keyA = a.date;
							const keyB = b.date;

							if (keyA > keyB) {
								return 1;
							}
							if (keyA < keyB) {
								return -1;
							}
							return 0;
						});
					}

					/* Subtract fuel quantities from the stocks, starting from the oldest stock,
					 * until the quantity requested in the transaction has been reached.
					 */
					let transactionQuantity = litersPremiumGasoline97;
					let i = 0;

					while (transactionQuantity > 0) {
						const availableStock = stocksPremiumGasoline97[i].quantityPurchased - stocksPremiumGasoline97[i].quantityDepleted;

						if (transactionQuantity >= availableStock) {
							transactionQuantity = transactionQuantity - availableStock;
							stocksPremiumGasoline97[i].quantityDepleted = parseInt(stocksPremiumGasoline97[i].quantityDepleted) + parseInt(availableStock);
						} else {
							stocksPremiumGasoline97[i].quantityDepleted = parseInt(stocksPremiumGasoline97[i].quantityDepleted) + parseInt(transactionQuantity);
							transactionQuantity = 0;
						}

						i++;
					}
				}


				/* If the transaction involves a purchase of kerosene, arrange the stocks in
				 * chronological order and subtract the quantity purchased beginning from the
				 * earliest available stock. */
				if (litersKerosene > 0) {
					/* If there are multiple stocks for the fuel type, arrange them in chronological order. */
					if (stocksKerosene.length >= 2) {
						stocksKerosene.sort(function(a, b) {
							const keyA = a.date;
							const keyB = b.date;

							if (keyA > keyB) {
								return 1;
							}
							if (keyA < keyB) {
								return -1;
							}
							return 0;
						});
					}

					/* Subtract fuel quantities from the stocks, starting from the oldest stock,
					 * until the quantity requested in the transaction has been reached.
					 */
					let transactionQuantity = litersKerosene;
					let i = 0;

					while (transactionQuantity > 0) {
						const availableStock = stocksKerosene[i].quantityPurchased - stocksKerosene[i].quantityDepleted;

						if (transactionQuantity >= availableStock) {
							transactionQuantity = transactionQuantity - availableStock;
							stocksKerosene[i].quantityDepleted = parseInt(stocksKerosene[i].quantityDepleted) + parseInt(availableStock);
						} else {
							stocksKerosene[i].quantityDepleted = parseInt(stocksKerosene[i].quantityDepleted) + parseInt(transactionQuantity);
							transactionQuantity = 0;
						}

						i++;
					}
				}

				/* Update the quantities depleted of the gasoline stocks. */
				for (i = 0; i < stocksGasoline.length; i++) {
					const filter = {_id: stocksGasoline[i]._id};
					const update = {
						quantityDepleted: stocksGasoline[i].quantityDepleted
					};

					db.updateOneIterative(Inventory, filter, update);
				}

				/* Update the quantities depleted of the Premium Gasoline 95 stocks. */
				for (i = 0; i < stocksPremiumGasoline95.length; i++) {
					const filter = {_id: stocksPremiumGasoline95[i]._id};
					const update = {
						quantityDepleted: stocksPremiumGasoline95[i].quantityDepleted
					};

					db.updateOneIterative(Inventory, filter, update);
				}

				/* Update the quantities depleted of the diesel stocks. */
				for (i = 0; i < stocksDiesel.length; i++) {
					const filter = {_id: stocksDiesel[i]._id};
					const update = {
						quantityDepleted: stocksDiesel[i].quantityDepleted
					};

					db.updateOneIterative(Inventory, filter, update);
				}

				/* Update the quantities depleted of the Premium Gasoline 97 stocks. */
				for (i = 0; i < stocksPremiumGasoline97.length; i++) {
					const filter = {_id: stocksPremiumGasoline97[i]._id};
					const update = {
						quantityDepleted: stocksPremiumGasoline97[i].quantityDepleted
					};

					db.updateOneIterative(Inventory, filter, update);
				}

				/* Update the quantities depleted of the kerosene stocks. */
				for (i = 0; i < stocksKerosene.length; i++) {
					const filter = {_id: stocksKerosene[i]._id};
					const update = {
						quantityDepleted: stocksKerosene[i].quantityDepleted
					};

					db.updateOneIterative(Inventory, filter, update);
				}

				/* The delivery ID for the delivery of a transaction has a starting digit of 2 and the same
				 * remaining digits as the transaction ID of its corresponding transaction.
				 */
				const deliveryId = parseInt(transactionId) + 10000000;

				/* Add the corresponding delivery for the transaction in the database. The other delivery
				 * details are left null to be updated by a delivery manager.
				 */
				const delivery = {
					id: deliveryId,
					date: null,
					customer: customer,
					dropoff: null,
					status: 'pending',
					number: number,
					warehouse: null,
					manager: null,
					driver: null
				};

				db.insertOne(Delivery, delivery, function(flag) {
					/* Increment the transaction number for the next new transaction. */
					const nextTransaction = parseInt(transactionId) + 1;

					/* Update the transaction number in the database. */
					const filter = {label: 'nextTransaction'};
					const update = {
						transactionNumber: nextTransaction
					};

					db.updateOne(TransactionNumber, filter, update, function(result) {
						res.status(200).json('Transaction added successfully.');
						res.send();
					});
				});
			});
		});
	}
};

module.exports = transactionController;
