Vue.config.devtools = true

$(document).ready(function() {
	$("#loading").show();
	$("#app").hide();

	$.getJSON("https://who-targets-me.herokuapp.com/demographics/", function(demographics) {

		var App = new Vue({
			el: '#app',
			data: {
				selectedConstituency: null,
				mapGenerated: false,
				demographics: demographics.data,
				threshold: 10,
				maxdownloads: 60,
				maxcoverage: 0.0001,
				geometries: [],
				showEmpty: true,
				parties: []
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
			watch: {
				threshold: function() {
					this.statistics();
				},
				showEmpty: function() {
					this.statistics();
				}
			},
			computed: {
				list: function() {
					if(this.geometries.length == 0) return [];
					return this.geometries;
				}
			},
			methods: {
				statistics: function() {
					console.log("Generating vis");

					var App = this;

					vega.embed("#age", {
						"$schema": "https://vega.github.io/schema/vega-lite/v2.json",
						"width": $("#age").width(),
						"height": 750,
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

						d3.json("hexagons-topo.json", function(error, hexmap) {
							d3.json("regions-topo.json", function(error, regionsmap) {
								d3.csv("ons-age.csv", function(error, agedata) {
									d3.csv("ge2015.csv", function(error, ge2015) {
										d3.json("datasets/parties.json", function(error, parties) {
											console.log("(Re)rendering map")
											App.parties = parties;
											App.generatePartyColorClasses();

											if (error) return console.error(error);

											hexmap.objects.hexagons.geometries.forEach((hex,index) => {
												if(!hexmap.objects.hexagons.geometries[index]) return false;

												// Population
												thisAgeRow = agedata.find((someConst)=>someConst.GEOID == hex.properties.constituency);
												hexmap.objects.hexagons.geometries[index].properties.pop = thisAgeRow.PopTotalConstNum;

												// Users
												thisUserRow = match(hex);
												hexmap.objects.hexagons.geometries[index].properties.users = typeof thisUserRow != 'string' ? thisUserRow.users : 0;

												// Coverage
												hexmap.objects.hexagons.geometries[index].properties.coverage = hexmap.objects.hexagons.geometries[index].properties.users / hexmap.objects.hexagons.geometries[index].properties.pop

												// Current party
												this2015 = ge2015.find((someConst)=>someConst.ons_id == hex.properties.constituency);
												hexmap.objects.hexagons.geometries[index].properties.party = this2015.party_name;
												hexmap.objects.hexagons.geometries[index].properties.partyObj = parties[1].list.find((p)=> {
													return p.name && this2015.party_name && (
														p.name.includes(this2015.party_name) || this2015.party_name.includes(p.name)
													);
												});
												hexmap.objects.hexagons.geometries[index].properties.partyid =
												hexmap.objects.hexagons.geometries[index].properties.partyObj ?
												hexmap.objects.hexagons.geometries[index].properties.partyObj.id : '';
												hexmap.objects.hexagons.geometries[index].properties.share = parseFloat(this2015.share);
											});

											App.maxcoverage = Math.max.apply(Math,hexmap.objects.hexagons.geometries.map((o) => o.properties.coverage))

											App.geometries = JSON.parse(JSON.stringify(hexmap.objects.hexagons.geometries
												.map((g)=>g.properties)
												.sort((a,b) => a.coverage - b.coverage)));

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
												// svg.selectAll("#hex path").sort(function (a, b) { // select the parent and sort the path's
												// 	if (a.properties.constituency != d.properties.constituency) return -1;               // a is not the hovered element, send "a" to the back
												// 	else return 1;                             // a is the hovered element, bring "a" to the front
												// });
												this.parentNode.appendChild(this);
												App.selectedConstituency = d.properties
												d3.event.stopPropagation();
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
