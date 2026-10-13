/* Strategy: políticas intercambiáveis de ajuste do estoque de um combustível.
 *
 * Cada estratégia recebe os lotes de UM combustível e a quantidade de litros da transação, e muta
 * quantityDepleted dos lotes recebidos, exatamente como os blocos repetidos dos handlers
 * postEditStatus* de controllers/transaction-controller.js (inclusive o uso de parseInt).
 *
 * Fragilidade herdada e preservada de propósito: se a quantidade ultrapassar o que os lotes
 * comportam, o laço sai do array e lança TypeError, como no original.
 */

/* Ordena os lotes por data crescente (mais antigo primeiro), só quando houver 2 ou mais. */
function sortByDate(stocks) {
	if (stocks.length >= 2) {
		stocks.sort(function(a, b) {
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
}

/* cancelled -> pending|completed: consome o estoque a partir do lote mais antigo (FIFO). */
class ConsumeStrategy {
	apply(stocks, liters) {
		sortByDate(stocks);

		let transactionQuantity = liters;
		let i = 0;

		while (transactionQuantity > 0) {
			const availableStock = stocks[i].quantityPurchased - stocks[i].quantityDepleted;

			if (transactionQuantity >= availableStock) {
				transactionQuantity = transactionQuantity - availableStock;
				stocks[i].quantityDepleted = parseInt(stocks[i].quantityDepleted) + parseInt(availableStock);
			} else {
				stocks[i].quantityDepleted = parseInt(stocks[i].quantityDepleted) + parseInt(transactionQuantity);
				transactionQuantity = 0;
			}

			i++;
		}
	}
}

/* pending|completed -> cancelled: devolve o estoque a partir do lote mais recente. */
class ReturnStrategy {
	apply(stocks, liters) {
		sortByDate(stocks);

		let transactionQuantity = liters;
		let i = stocks.length - 1;

		while (transactionQuantity > 0) {
			const depletedStock = stocks[i].quantityDepleted;

			if (transactionQuantity >= depletedStock) {
				transactionQuantity = transactionQuantity - depletedStock;
				stocks[i].quantityDepleted = 0;
			} else {
				stocks[i].quantityDepleted = parseInt(stocks[i].quantityDepleted) - parseInt(transactionQuantity);
				transactionQuantity = 0;
			}

			i--;
		}
	}
}

/* Null Object: transições que não mexem no estoque. */
class NoStockChangeStrategy {
	apply() {}
}

/* As estratégias não guardam estado, então cada uma tem uma única instância compartilhada. */
module.exports = {
	ConsumeStrategy: Object.freeze(new ConsumeStrategy()),
	ReturnStrategy: Object.freeze(new ReturnStrategy()),
	NoStockChange: Object.freeze(new NoStockChangeStrategy())
};
