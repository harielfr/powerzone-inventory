const expect = require('chai').expect;

const {FUEL_TYPES, groupStocksByFuel} = require('../services/fuel-types.js');

describe('registro de combustíveis (services/fuel-types.js)', function() {
	it('lista os 5 combustíveis com o tipo do inventário e o campo de litros da transação', function() {
		expect(FUEL_TYPES.map(function(fuel) {
			return [fuel.key, fuel.inventoryType, fuel.litersField];
		})).to.deep.equal([
			['gasoline', 'gasoline', 'litersGasoline'],
			['premium-gasoline-95', 'premium-gasoline-95', 'litersPremiumGasoline95'],
			['diesel', 'diesel', 'litersDiesel'],
			['premium-gasoline-97', 'premium-gasoline-97', 'litersPremiumGasoline97'],
			['kerosene', 'kerosene', 'litersKerosene']
		]);
	});

	describe('groupStocksByFuel', function() {
		it('separa os lotes por tipo, preservando a ordem de entrada e as referências', function() {
			const g1 = {_id: 'g1', type: 'gasoline'};
			const d1 = {_id: 'd1', type: 'diesel'};
			const g2 = {_id: 'g2', type: 'gasoline'};
			const p95 = {_id: 'p95', type: 'premium-gasoline-95'};
			const p97 = {_id: 'p97', type: 'premium-gasoline-97'};
			const k = {_id: 'k', type: 'kerosene'};

			const groups = groupStocksByFuel([g1, d1, g2, p95, p97, k]);

			expect(groups['gasoline']).to.have.ordered.members([g1, g2]);
			expect(groups['gasoline'][0]).to.equal(g1);
			expect(groups['diesel']).to.have.ordered.members([d1]);
			expect(groups['premium-gasoline-95']).to.have.ordered.members([p95]);
			expect(groups['premium-gasoline-97']).to.have.ordered.members([p97]);
			expect(groups['kerosene']).to.have.ordered.members([k]);
		});

		it('cria um grupo vazio para cada combustível sem lotes', function() {
			expect(groupStocksByFuel([])).to.deep.equal({
				'gasoline': [],
				'premium-gasoline-95': [],
				'diesel': [],
				'premium-gasoline-97': [],
				'kerosene': []
			});
		});

		it('trata lotes de tipo desconhecido (ou ausente) como kerosene, como o else do original', function() {
			const k = {_id: 'k', type: 'kerosene'};
			const bio = {_id: 'bio', type: 'biodiesel'};
			const none = {_id: 'none'};
			const proto = {_id: 'proto', type: 'constructor'};

			const groups = groupStocksByFuel([bio, k, none, proto]);

			expect(groups['kerosene']).to.have.ordered.members([bio, k, none, proto]);
		});
	});
});
