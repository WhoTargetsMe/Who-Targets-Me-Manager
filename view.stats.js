Vue.config.devtools = true

var orderBy = {
	users: (a,b) => a.properties.users - b.properties.users,
	coverage: (a,b) => a.properties.coverage - b.properties.coverage,
	electorate: (a,b) =>  a.properties.electorate - b.properties.electorate,
	first_party_share: (a,b) =>  a.properties.first_party.share - b.properties.first_party.share,
	second_party_share: (b,a) =>  a.properties.second_party.share - b.properties.second_party.share,
	first_party: (a,b) =>  {
		var nameA=a.properties.first_party.name.toLowerCase(), nameB=b.properties.first_party.name.toLowerCase();
		if (nameA < nameB) return -1;
		if (nameA > nameB) return 1;
		return 0;
	},
	second_party: (a,b) =>  {
		var nameA=a.properties.second_party.name.toLowerCase(), nameB=b.properties.second_party.name.toLowerCase();
		if (nameA < nameB) return -1;
		if (nameA > nameB) return 1;
		return 0;
	},
	brexit: (b,a) =>  a.properties.brexit - b.properties.brexit
}

$(document).ready(function() {
	$("#loading").show();
	$("#app").hide();

	$.getJSON("https://who-targets-me.herokuapp.com/demographics/", function(demographics) {

		Vue.filter('d', function (value,x = 0) {
			var commaFormat = new Intl.NumberFormat('en-GB', {minimumFractionDigits: x, maximumFractionDigits: x});
		    return commaFormat.format(value);
		});

		Vue.filter('%', function (value,x = 0) {
		    return (value*100).toFixed(x)+"%"
		});

		var App = new Vue({
			el: '#app',
			data: {
				selectedConstituency: null,
				mapGenerated: false,
				demographics: demographics.data,
				userCount: 0,
				avgAge: 0,
				brexitCoverage: 0,
				electorate: 0,
				medianUsers: 0,
				threshold: 10,
				maxdownloads: 60,
				maxcoverage: 0.0001,
				geometries: [],
				showEmpty: true,
				parties: [],
				coverageByParty: {},
				orderBy: 'coverage'
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
				App.userCount = App.demographics.gender[0].count + App.demographics.gender[1].count + App.demographics.gender[2].count;
				App.avgAge = App.demographics.age.reduce((sum,next,thisAge)=>sum+=(next.count*(thisAge+13)),0) / App.userCount;

				$( window ).resize(() => App.statistics() );
				App.statistics()
			},
			watch: {
				threshold: function() {
					this.statistics();
				},
				showEmpty: function() {
					this.statistics();
				},
				orderBy: function() {
					this.geometries = this.geometries.sort(orderBy[this.orderBy]);
				}
			},
			methods: {
				orderTable: function(x) {
					this.orderBy = x;
					this.geometries = this.geometries.sort(orderBy[this.orderBy]);
				},
				statistics: function() {
					console.log("Generating vis");

					var App = this;

					vega.embed("#age", {
						"$schema": "https://vega.github.io/schema/vega-lite/v2.json",
						"width": $("#age").width(),
						"height": 739,
						"data": {
							"values": App.demographics.age
						},
						"mark": "bar",
						"encoding": {
							"y": {"field": "age", "type": "nominal", "axis": { "domain": false, "title": "", "labelPadding": 10 }, sort: "descending" },
							"x": {"field": "count", "type": "quantitative", "axis": { "domain": false, "title": "" } },
							"color": {
							  "field": "x",
							  "type": "nominal",
							//   "scale": {"range": App.partyColours},
							  "legend": false
							}
						},
						"config": { "axis": { "labelFont": "lato", "ticks": false, "labelFontSize": 10, "labelColor":"#777" } }
					}, {
						"mode": "vega-lite",
						"renderer": "svg",
						"actions": false,
						"config": {
							"autosize": { "type": "fit", "resize": true }
						}
					}, function(error, result) {
					});

					/////////

					App.maxdownloads = Math.max.apply(Math,App.demographics.constituencies.map((o) => o.users))
					var domain = [0];
					if(App.showEmpty == true) domain.push(0.0000001);
					domain.push(App.threshold == 'coverage' ? App.maxcoverage : App.threshold);
					var range = [];
					if(App.showEmpty == true) range.push('#DD2200');
					range.push('#d5d5da','#000000');
					// console.log(domain,range);
					var color_scale = d3.scaleLinear().domain(domain).range(range)

					var width = 480;
					var height = 750;

					var projection = d3.geoAlbers()
						.center([0, 55.4])
						.rotate([4.4, 0])
						.parallels([50, 60])
						.scale(1200 * 4)
						.translate([width/4, height/2.5]);

					var path = d3.geoPath()
						.projection(projection)
						.pointRadius(2);

					var svg = d3.select('#constituencies svg')
						.attr('width', width)
						.attr('height', height);

					function match(y) {
						return App.demographics.constituencies.find((x)=>x.geoid==y.properties.constituency) || y.properties.name
					}

					if(App.mapGenerated == true) {
						console.log("Changing colours")
						// update colours
						svg.selectAll('.constituency')
							// .enter()
							.attr("fill", function(d) {
								return color_scale(App.threshold == 'coverage' ? d.properties.coverage : d.properties.users);
							})
					} else {
						// App.mapGenerated = true;

						d3.json("datasets/hexagons-topo.json", function(error, hexmap) {
							d3.json("datasets/regions-topo.json", function(error, regionsmap) {
								d3.csv("datasets/constituencyVotes.csv", function(error, ge2015) {
									d3.json("datasets/parties.json", function(error, parties) {
										console.log("(Re)rendering map")
										App.parties = parties;
										App.generatePartyColorClasses();

										if (error) return console.error(error);

										// Data for first, second parties
										var p12 = ['first_party','second_party'];

										hexmap.objects.hexagons.geometries.forEach((hex,index) => {
											if(!hexmap.objects.hexagons.geometries[index]) return false;
											// Match constituency
											this2015 = ge2015.find((someConst)=>someConst.ons_id == hex.properties.constituency);
											if(!this2015) console.log("Couldn't match "+hex.properties.constituency)

											// Brexit vote
											hexmap.objects.hexagons.geometries[index].properties.brexit = parseFloat(this2015.leaveshare || 0);

											// Electorate 2015
											hexmap.objects.hexagons.geometries[index].properties.electorate = parseInt(this2015.electorate || 0);
											App.electorate += hexmap.objects.hexagons.geometries[index].properties.electorate;

											// Users
											thisUserRow = match(hex);
											hexmap.objects.hexagons.geometries[index].properties.users = parseInt(typeof thisUserRow != 'string' ? thisUserRow.users : 0);

											// Coverage
											hexmap.objects.hexagons.geometries[index].properties.coverage = hexmap.objects.hexagons.geometries[index].properties.users / hexmap.objects.hexagons.geometries[index].properties.electorate

											p12.forEach(function(oneTwo) {
												// This party
												var thisParty = {};
												thisParty.id = this2015[oneTwo];
												thisParty.votes = parseInt(this2015[thisParty.id] || this2015.other);
												thisParty.share = parseFloat(thisParty.votes / this2015.valid_votes);
												Object.assign(thisParty,parties[1].list.find((p)=> {
													var pID = p.id.toLowerCase();
													var pName = p.name.toLowerCase();
													var pShortName = p.short_name.toLowerCase();
													var thisID = this2015[oneTwo.toLowerCase()].toLowerCase();
													var x = (
														// thisID.includes(pID) ||
														// thisID.includes(pName) ||
														// pID.includes(thisID) ||
														// pName.includes(thisID)
														pID == thisID ||
														pName == thisID ||
														pShortName == thisID
													);
													return x;
												}));
												if(!thisParty.name) {
													thisParty.short_name = thisParty.id;
													thisParty.name = thisParty.id;
												}

												// Merge into hex object
												hexmap.objects.hexagons.geometries[index].properties[oneTwo] = thisParty;
											})
										});
										App.geometries = JSON.parse(JSON.stringify(hexmap.objects.hexagons.geometries.sort(orderBy['users'])));
										App.medianUsers = App.geometries[325].properties.users;
										App.geometries = App.geometries.sort(orderBy[App.orderBy]);

										p12.forEach(function(oneTwo) {
											// National volunteer coverage calculations
											var oneTwoPartyList = hexmap.objects.hexagons.geometries.reduce(function(result, constituency) {
												if (result[constituency.properties[oneTwo].id]) {
													// console.log("Adding to"+constituency.properties[oneTwo].id)
													result[constituency.properties[oneTwo].id].volunteers += parseInt(constituency.properties.users);
													result[constituency.properties[oneTwo].id].electorate += parseInt(constituency.properties.electorate);
													result[constituency.properties[oneTwo].id].coverage = result[constituency.properties[oneTwo].id].volunteers / result[constituency.properties[oneTwo].id].electorate;
												} else {
													// console.log("Making ",constituency.properties[oneTwo].id)
													result[constituency.properties[oneTwo].id] = {
														id: constituency.properties[oneTwo].id,
														volunteers: parseInt(constituency.properties.users),
														electorate: parseInt(constituency.properties.electorate),
														coverage: parseInt(constituency.properties.users) / parseInt(constituency.properties.electorate)
													}
													Object.assign(result[constituency.properties[oneTwo].id],constituency.properties[oneTwo]);
												}
												return result;
											}, {})
											App.coverageByParty[oneTwo] = Object.keys(oneTwoPartyList).map(key => oneTwoPartyList[key]).sort((a,b)=>b.coverage-a.coverage);
										});

										// National brexit coverage
										// App.brexitCoverage = hexmap.objects.hexagons.geometries.reduce((sum, cons) => cons.properties.share*cons.properties.users) / App.userCount;

										App.brexitCoverage = hexmap.objects.hexagons.geometries.reduce((sum,cons)=>sum += cons.properties.brexit * cons.properties.users,0) / App.userCount;

										// Carry on...

										App.maxcoverage = Math.max.apply(Math,hexmap.objects.hexagons.geometries.map((o) => o.properties.coverage))

										var constituencies = topojson.feature(hexmap, hexmap.objects.hexagons);

										svg.append('g')
											.attr('id','hex')
											.selectAll(".constituency")
										    .data(constituencies.features)
										  	.enter().append("path")
										    .attr("class", function(d) { return "constituency"; })
										    .attr("id", function(d) { return d.properties.constituency; })
										    .attr("d", path)
											.attr("fill", function(d) {
												return color_scale(App.threshold == 'coverage' ? d.properties.coverage : d.properties.users);
											})
											.append('title')
											.text(function(constituency) {
												var thisConstituency = match(constituency);
												return constituency.properties.name + ": " + (typeof thisConstituency != 'string' ? thisConstituency.users : 0) +" volunteers";
											})

										var regions = topojson.feature(regionsmap, regionsmap.objects.regions);

										svg.append('g')
											.attr('id','regions')
											.selectAll(".regions")
										    .data(regions.features)
										  	.enter().append("path")
										    .attr("class", function(d) { return "region "+d.coordinates; })
										    .attr("id", function(d) { return d.properties.name; })
										    .attr("d", path);

										d3.selectAll(".constituency").on('mouseover', function(d) {
											this.parentNode.appendChild(this);
											App.selectedConstituency = JSON.parse(JSON.stringify(d.properties));
										})

										$("#loading").hide();
										$("#app").show();
										console.log("All loaded");
										if(!App.mapGenerated) App.statistics()
										App.mapGenerated = true;
									});
								});
							});
						});
					}
				},
				generatePartyColorClasses: function() {
					var css = "";

					this.parties[1].list.forEach(function(party) {
						css +=`

						.party-${party.id} {
							background-color: ${party.srgb ? '#'+party.srgb : 'gray'} !important;
							color: ${party.srgb ? invertHEX(party.srgb, true) : 'white'} !important;
						}`;
					});

					$(`<style id='party-styles'>${css}</style>`).appendTo("head");

					function invertHEX(hex, bw) {
						if (hex.indexOf('#') === 0) {
							hex = hex.slice(1);
						}
						// convert 3-digit hex to 6-digits.
						if (hex.length === 3) {
							hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
						}
						if (hex.length !== 6) {
							throw new Error('Invalid HEX color.');
						}
						var r = parseInt(hex.slice(0, 2), 16),
							g = parseInt(hex.slice(2, 4), 16),
							b = parseInt(hex.slice(4, 6), 16);
						if (bw) {
							// http://stackoverflow.com/a/3943023/112731
							return (r * 0.299 + g * 0.587 + b * 0.114) > 186
								? '#000000'
								: '#FFFFFF';
						}
						// invert color components
						r = (255 - r).toString(16);
						g = (255 - g).toString(16);
						b = (255 - b).toString(16);
						// pad each with zeros and return
						return "#" + padZero(r) + padZero(g) + padZero(b);
					}

					function padZero(str, len) {
						len = len || 2;
						var zeros = new Array(len).join('0');
						return (zeros + str).slice(-len);
					}
				}
			}
		});
	});
});
