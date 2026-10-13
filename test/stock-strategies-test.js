const expect = require('chai').expect;

const {ConsumeStrategy, ReturnStrategy, NoStockChange} = require('../services/stock-strategies.js');

function stock(id, date, quantityPurchased, quantityDepleted) {
	return {_id: id, type: 'gasoline', date: new Date(date), quantityPurchased: quantityPurchased, quantityDepleted: quantityDepleted};
}

/* Depleção de cada lote por _id, independente da ordem do array. */
function depletion(stocks) {
	const result = {};
	stocks.forEach(function(s) {
		result[s._id] = s.quantityDepleted;
	});
	return result;
}

function ids(stocks) {
	return stocks.map(function(s) {
		return s._id;
	});
}

describe('estratégias de estoque (services/stock-strategies.js)', function() {
	describe('ConsumeStrategy: consome a partir do lote mais antigo', function() {
		it('1 lote: consome parcialmente', function() {
			const stocks = [stock('a', '2022-01-01', 100, 30)];
			ConsumeStrategy.apply(stocks, 50);
			expect(depletion(stocks)).to.deep.equal({a: 80});
		});

		it('1 lote: quantidade exata do disponível esgota o lote', function() {
			const stocks = [stock('a', '2022-01-01', 100, 30)];
			ConsumeStrategy.apply(stocks, 70);
			expect(depletion(stocks)).to.deep.equal({a: 100});
		});

		it('2 lotes: quantidade que atravessa lotes esgota o mais antigo e segue para o próximo', function() {
			const stocks = [stock('old', '2022-01-01', 100, 90), stock('new', '2022-02-01', 100, 0)];
			ConsumeStrategy.apply(stocks, 25);
			expect(depletion(stocks)).to.deep.equal({old: 100, new: 15});
		});

		it('3 lotes fora de ordem: ordena por data e pula lotes já esgotados', function() {
			const stocks = [
				stock('new', '2022-03-01', 100, 0),
				stock('old', '2022-01-01', 100, 100),
				stock('mid', '2022-02-01', 100, 60)
			];
			ConsumeStrategy.apply(stocks, 60);
			expect(ids(stocks)).to.deep.equal(['old', 'mid', 'new']);
			expect(depletion(stocks)).to.deep.equal({old: 100, mid: 100, new: 20});
		});

		it('3 lotes: quantidade exata do total disponível esgota todos sem erro', function() {
			const stocks = [
				stock('c', '2022-03-01', 10, 0),
				stock('a', '2022-01-01', 10, 5),
				stock('b', '2022-02-01', 10, 5)
			];
			ConsumeStrategy.apply(stocks, 20);
			expect(depletion(stocks)).to.deep.equal({a: 10, b: 10, c: 10});
		});

		it('quantidade 0 não altera os lotes (mas ordena, como o original)', function() {
			const stocks = [stock('b', '2022-02-01', 10, 1), stock('a', '2022-01-01', 10, 2)];
			ConsumeStrategy.apply(stocks, 0);
			expect(ids(stocks)).to.deep.equal(['a', 'b']);
			expect(depletion(stocks)).to.deep.equal({a: 2, b: 1});
		});

		it('usa parseInt nas somas, como o original', function() {
			const stocks = [stock('a', '2022-01-01', 100, '30')];
			ConsumeStrategy.apply(stocks, 10.7);
			expect(stocks[0].quantityDepleted).to.equal(40);
		});

		it('fragilidade preservada: quantidade acima do disponível lança TypeError', function() {
			const stocks = [stock('a', '2022-01-01', 10, 0)];
			expect(function() {
				ConsumeStrategy.apply(stocks, 11);
			}).to.throw(TypeError);
		});
	});

	describe('ReturnStrategy: devolve a partir do lote mais recente', function() {
		it('1 lote: devolve parcialmente', function() {
			const stocks = [stock('a', '2022-01-01', 100, 30)];
			ReturnStrategy.apply(stocks, 10);
			expect(depletion(stocks)).to.deep.equal({a: 20});
		});

		it('1 lote: quantidade exata do consumido zera o lote', function() {
			const stocks = [stock('a', '2022-01-01', 100, 30)];
			ReturnStrategy.apply(stocks, 30);
			expect(depletion(stocks)).to.deep.equal({a: 0});
		});

		it('2 lotes: quantidade que atravessa lotes zera o mais recente e segue para o anterior', function() {
			const stocks = [stock('old', '2022-01-01', 100, 100), stock('new', '2022-02-01', 100, 15)];
			ReturnStrategy.apply(stocks, 25);
			expect(depletion(stocks)).to.deep.equal({old: 90, new: 0});
		});

		it('3 lotes fora de ordem: ordena por data e devolve do mais recente para o mais antigo', function() {
			const stocks = [
				stock('mid', '2022-02-01', 100, 60),
				stock('new', '2022-03-01', 100, 30),
				stock('old', '2022-01-01', 100, 100)
			];
			ReturnStrategy.apply(stocks, 50);
			expect(ids(stocks)).to.deep.equal(['old', 'mid', 'new']);
			expect(depletion(stocks)).to.deep.equal({old: 100, mid: 40, new: 0});
		});

		it('lote mais recente sem consumo é atravessado sem alteração', function() {
			const stocks = [stock('old', '2022-01-01', 100, 50), stock('new', '2022-02-01', 100, 0)];
			ReturnStrategy.apply(stocks, 20);
			expect(depletion(stocks)).to.deep.equal({old: 30, new: 0});
		});

		it('usa parseInt nas subtrações, como o original', function() {
			const stocks = [stock('a', '2022-01-01', 100, '30')];
			ReturnStrategy.apply(stocks, 10.7);
			expect(stocks[0].quantityDepleted).to.equal(20);
		});

		it('fragilidade preservada: quantidade acima do consumido lança TypeError', function() {
			const stocks = [stock('a', '2022-01-01', 10, 5)];
			expect(function() {
				ReturnStrategy.apply(stocks, 6);
			}).to.throw(TypeError);
		});
	});

	describe('NoStockChange (Null Object)', function() {
		it('não altera nem reordena os lotes', function() {
			const stocks = [stock('b', '2022-02-01', 10, 1), stock('a', '2022-01-01', 10, 2)];
			NoStockChange.apply(stocks, 5);
			expect(ids(stocks)).to.deep.equal(['b', 'a']);
			expect(depletion(stocks)).to.deep.equal({a: 2, b: 1});
		});
	});
});
