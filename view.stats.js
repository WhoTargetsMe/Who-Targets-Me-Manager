Vue.config.devtools = true

$(document).ready(function() {
	$("#loading").show();
	$("#app").hide();

	$.getJSON("https://who-targets-me.herokuapp.com/demographics/", function(demographics) {

		$("#loading").hide();
		$("#app").show();
		console.log("All loaded");

		var App = new Vue({
			el: '#app',
			data: {
				selectedConstituency: null,
				mapGenerated: false,
				demographics: demographics.data
			},
			mounted: function() {
				var App = this;
				// Load statistics
				var ages = new Array(90);
				App.demographics.age.map((year) => {
					ages[year.age] = year
				});
				for(var i=13; i < 90; i++) {
					if(ages[i] == undefined) ages[i] = { age: i, count: 0 }
				}
				App.demographics.age = ages.slice(13,91);

				$( window ).resize(() => App.statistics() );
				App.statistics()
			},
			methods: {
				statistics: function() {
					var App = this;

					vega.embed("#age", {
						"$schema": "https://vega.github.io/schema/vega-lite/v2.json",
						"width": $("#age").width(),
						"height": 350,
						"data": {
							"values": App.demographics.age
						},
						"mark": "bar",
						"encoding": {
							"x": {"field": "age", "type": "nominal", "axis": { "domain": false, "title": "", "labelPadding": 10 } },
							"y": {"field": "count", "type": "quantitative", "axis": { "domain": false, "title": "" } },
							"color": {
							  "field": "x",
							  "type": "nominal",
							//   "scale": {"range": App.partyColours},
							  "legend": false
							}
						},
						"config": { "axis": { "labelFont": "lato", "ticks": false, "labelFontSize": 11, "labelColor":"#777" } }
					}, {
						"mode": "vega-lite",
						"actions": false,
						"config": {
							"autosize": { "type": "fit", "resize": true }
						}
					}, function(error, result) {
					});

					if(App.mapGenerated == false) {
						App.mapGenerated = true;
						var UK_GENERAL_ELECTION_RESULTS_2010 = App.demographics.constituencies

						// Credit to http://bl.ocks.org/timcraft/5866773 for this map
						var base_color = '#2D4357'
						var max_downloads = Math.max.apply(Math,UK_GENERAL_ELECTION_RESULTS_2010.map((o) => o.users))
						var color_scale = d3.scaleLinear().domain([0,10]).range(['white', base_color])

						var svg = d3.select('#constituencies').append('svg')
						.attr('width', $("#constituencies").outerWidth())
						.attr('height', 400);

						var map = UK.ElectionMap(4.8)
						.fill(function(constituency) {
							var thisConstituency = getConstituency(constituency);
							return color_scale(typeof thisConstituency != 'string' ? thisConstituency.users : 0) || 'white';
						})
						.origin({x: 60, y: 390});

						map(svg);

						svg.on('click', function() {
							more_info = d3.select("#more_info")
							more_info.classed('hidden', true)
							d3.select('#more_info_backup').classed('hidden', false)
							more_info.select("#constituency_name").text("")
							more_info.select("#download_count").text("")
						})

						d3.selectAll(".constituency")
						.append('title')
						.text(function(constituency) {
							var thisConstituency = getConstituency(constituency[2]);
							return constituency[2] + ": " + (typeof thisConstituency != 'string' ? thisConstituency.users : constituency[2]);
						})
						d3.selectAll(".constituency").on('mouseover', function(constituency) {
							App.selectedConstituency = getConstituency(constituency[2]);
							d3.event.stopPropagation();
						})
					}

					function getConstituency(constituencyName) {
						var constituency = new Set(constituencyName.toLowerCase().replace(",","").split(" "));

						var find = UK_GENERAL_ELECTION_RESULTS_2010.find((o) => {
							var checkConstituency = new Set(o.name.toLowerCase().replace(",","").split(" "));
							return eqSet(checkConstituency, constituency)
						});
						if(!find) console.log(constituencyName);
						return find || constituencyName;
					}

					function eqSet(as, bs) {
					    return as.size === bs.size && all(isIn(bs), as);
					}

					function all(pred, as) {
					    for (var a of as) if (!pred(a)) return false;
					    return true;
					}

					function isIn(as) {
					    return function (a) {
					        return as.has(a);
					    };
					}
				}
			}
		});
	});
});
