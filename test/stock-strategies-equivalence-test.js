/* Teste de equivalência: compara as estratégias novas com o algoritmo original de UM combustível,
 * copiado literalmente de controllers/transaction-controller.js na tag v1-original
 * (devolução: postEditStatusCancelled, l.200-236; consumo: postEditStatusCompleted, l.565-600).
 * As entradas são geradas por um PRNG com semente fixa, então a execução é reprodutível.
 */
const expect = require('chai').expect;

const {ConsumeStrategy, ReturnStrategy} = require('../services/stock-strategies.js');

/* Cópia do original (v1-original, l.565-600). Só o bloco foi envolvido numa função. */
function legacyConsume(transaction, stocksGasoline) {
	if (transaction.litersGasoline > 0) {
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
		let transactionQuantity = transaction.litersGasoline;
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
}

/* Cópia do original (v1-original, l.200-236). Só o bloco foi envolvido numa função. */
function legacyReturn(transaction, stocksGasoline) {
	if (transaction.litersGasoline > 0) {
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
		let transactionQuantity = transaction.litersGasoline;
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

/* PRNG mulberry32: determinístico a partir da semente. */
function mulberry32(seed) {
	return function() {
		seed |= 0;
		seed = seed + 0x6D2B79F5 | 0;
		let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}

function randomInt(random, min, max) {
	return min + Math.floor(random() * (max - min + 1));
}

/* Gera de 1 a 5 lotes, com datas possivelmente repetidas e fora de ordem. */
function randomStocks(random) {
	const count = randomInt(random, 1, 5);
	const stocks = [];
	for (let i = 0; i < count; i++) {
		const purchased = randomInt(random, 1, 200);
		stocks.push({
			_id: 's' + i,
			type: 'gasoline',
			date: new Date(2022, 0, randomInt(random, 1, 4)),
			quantityPurchased: purchased,
			quantityDepleted: randomInt(random, 0, purchased)
		});
	}
	return stocks;
}

function totalOf(stocks, valueOf) {
	return stocks.reduce(function(sum, s) {
		return sum + valueOf(s);
	}, 0);
}

/* Litros entre 0 e o limite. Às vezes fracionário, para exercitar o parseInt. */
function randomLiters(random, limit) {
	const liters = randomInt(random, 0, limit);
	return random() < 0.2 && liters > 0 ? liters - 0.5 : liters;
}

function clone(stocks) {
	return stocks.map(function(s) {
		return Object.assign({}, s);
	});
}

/* Executa a função capturando a exceção, para comparar também os casos que estouram o array. */
function run(fn) {
	try {
		fn();
		return {error: null};
	} catch (e) {
		return {error: e.constructor.name};
	}
}

function expectEquivalent(legacy, strategy, stocks, liters) {
	const legacyStocks = clone(stocks);
	const newStocks = clone(stocks);

	const legacyOutcome = run(function() {
		legacy({litersGasoline: liters}, legacyStocks);
	});
	const newOutcome = run(function() {
		/* O handler original só entra no bloco quando litros > 0; o StockService faz o mesmo. */
		if (liters > 0) {
			strategy.apply(newStocks, liters);
		}
	});

	const context = JSON.stringify({stocks: stocks, liters: liters});
	expect(newOutcome, context).to.deep.equal(legacyOutcome);
	expect(newStocks, context).to.deep.equal(legacyStocks);
}

const CASES = 500;

describe('equivalência das estratégias com o algoritmo original (v1-original)', function() {
	it('ConsumeStrategy equivale ao consumo original em ' + CASES + ' entradas dentro do disponível', function() {
		const random = mulberry32(20221013);
		for (let n = 0; n < CASES; n++) {
			const stocks = randomStocks(random);
			const available = totalOf(stocks, function(s) {
				return s.quantityPurchased - s.quantityDepleted;
			});
			expectEquivalent(legacyConsume, ConsumeStrategy, stocks, randomLiters(random, available));
		}
	});

	it('ReturnStrategy equivale à devolução original em ' + CASES + ' entradas dentro do consumido', function() {
		const random = mulberry32(42);
		for (let n = 0; n < CASES; n++) {
			const stocks = randomStocks(random);
			const depleted = totalOf(stocks, function(s) {
				return s.quantityDepleted;
			});
			expectEquivalent(legacyReturn, ReturnStrategy, stocks, randomLiters(random, depleted));
		}
	});

	it('ambas reproduzem o original também acima do limite (inclusive o TypeError)', function() {
		const random = mulberry32(7);
		let errors = 0;
		for (let n = 0; n < CASES; n++) {
			const stocks = randomStocks(random);
			const purchased = totalOf(stocks, function(s) {
				return s.quantityPurchased;
			});
			const liters = randomLiters(random, purchased + 50);

			expectEquivalent(legacyConsume, ConsumeStrategy, stocks, liters);
			expectEquivalent(legacyReturn, ReturnStrategy, stocks, liters);

			if (run(function() {
				legacyConsume({litersGasoline: liters}, clone(stocks));
			}).error) {
				errors++;
			}
		}
		/* Garante que a amostra realmente exercita o caso de estouro. */
		expect(errors).to.be.above(0);
	});
});
