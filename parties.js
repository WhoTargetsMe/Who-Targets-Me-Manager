var generatedMap = false;

$(document).ready(function() {
	$("#loading").show();
	$("#app").hide();

	/*  Load these all from the server. See individual files for expected format */
	var parties = [];
	var advertisers = [];
	$.getJSON("datasets/parties.json?v="+Date.now(), (partiesJSON) => { parties = partiesJSON; start(); });
	$.getJSON("datasets/mock-advertisers.json?v="+Date.now(), (advertisersJSON) => { advertisers = advertisersJSON; start(); });

	function start() {
		console.log(parties.length, advertisers.length);

		if(parties.length == 0 || advertisers.length == 0) return false;

		$("#loading").hide();
		$("#app").show();
		console.log("All loaded");

		Vue.component('party-span', {
			template: "#party-span",
			props: {
				'party': Object,
			  	'chars': {
					type: Number,
			  		default: 20
				},
				'advertiser': Object
			}
		});

		Vue.component('advertiser-table', {
			template: "#advertiser-table",
			props: {
				'advertisers': Object,
				'parties': Object,
				'politicians': Object,
				'suggestengine': Object,
				'finished': {
					default: false
				}
			},
			methods: {
				topparties: function(x) {
					return this.parties[1].list.slice(0,x);
				},
				suggestParty: function(advertiser) {
					var Component = this;
					var likelyParties = new Set();

					// console.log("Suggesting for "+advertiser.advertiser+", with "+Component.politicians.length+" possible matches")
					if(Component.suggestengine) {
						var matchedEntities = Component.politicians.filter(function(candidate) {
							return (
								candidate.name == advertiser.advertiser
								|| candidate.name.includes(advertiser.advertiser) // E.g. Jeremy Corbyn
								|| advertiser.advertiser.includes(candidate.name) //  	and Jeremy Corbyn MP
								|| (candidate.facebook && candidate.facebook != ""
									&& (candidate.facebook.includes(advertiser.advertiser_id) // Might have a weird old one like https://www.facebook.com/Alan-Duncan-150454050066
										||
										(	advertiser.advertiser_vanity
											&& advertiser.advertiser_vanity != ""
											&& candidate.facebook.includes(advertiser.advertiser_vanity) // Newer profiles will use vanity url
										)
									)
								)
							)
						});

						if(matchedEntities.length && matchedEntities.length > 0) {
							// console.log("Matches for "+advertiser.advertiser,matchedEntities)
							matchedEntities.forEach(function(entity) {
								likelyParties.add(entity.party);
							});
						}
					}

					likelyParties = Array.from(likelyParties)
					likelyParties = likelyParties.map((id) => Component.parties[1].list.find((someParty)=> someParty.id == id) );
					return likelyParties;
				},
				touch: function(x,prop,$event = null) {
					var Component = this;

					if($event) {
						// console.log("Listening for selection on",$($event.target))
						$($event.target).change(() => {
							// console.log("Clicked dropdown",$event.target);
							$($event.target).off('change');
							touchHappened()
						});
					} else touchHappened();

					function touchHappened() {
						// console.log("!!!!! I just clicked ",x.advertiser);
						x.touchedDate = Date.now();
						x.touchedProperty = prop;

						if(x) {
							// console.log("Touched "+x.touchedProperty+" on "+x.advertiser);
							if(x.touchedProperty == 'political') {
								if(x.political == 'true') {
									// console.log("Nonpartisan "+x.advertiser)
									x.affiliation = 'no-party';
								} else {
									// console.log("Clearing affil for "+x.advertiser)
									x.affiliation = '';
								}
							} else if(x.touchedProperty == 'affiliation') {
								if(x.affiliation != '') {
									// console.log("Applying political to "+x.advertiser)
									x.political = 'true';
								} else {
									// console.log("Clearing political for "+x.advertiser)
									x.political = 'false';
								}
							}

							Component.$forceUpdate();
						}
					}
				}
			},
			watch: {
				'advertisers': {
					handler: function(newAds, oldAds) {
						graph();
					},
					deep: true
				}
			}
		});

		var App = new Vue({
			el: '#app',
			data: {
				advertisers: advertisers, // To be loaded from the DB
				parties: parties, // To be loaded from the DB
				adverts: [], // Mock data, needs to load from DB
				suggestengine: false,
				suggestionDatasets: [
					{url:"datasets/candidates-2015.json?v="+Date.now(), data: []},
					{url:"datasets/everypolitician-term-56-reduced.json?v="+Date.now(), data: []}
				],
				demographics: [],
				selectedConstituency: null,
				mapGenerated: false
			},
			created: function() {
				var App = this;

				// Mock advert data
				App.advertisers.forEach(function(advertiser) {
					var min = 3;
					var max = 15;
					var randomNofAds = Math.floor(Math.random() * (max - min + 1) + min);
					for(var i=0; i < randomNofAds; i++){
						App.adverts.push({"advertiser_id": advertiser.advertiser_id});
					}
				});

				// Load suggestion engine datasets
				App.suggestionDatasets.forEach(function(dataset,index) {
					$.getJSON(dataset.url, function(dataJSON) {
						console.log("Loaded "+dataset.url);
						App.suggestionDatasets[index].data = dataJSON
						App.$forceUpdate();
					});
				});

				// Load statistics
				$.getJSON("https://who-targets-me.herokuapp.com/demographics/", function(d) {
					var ages = new Array(90);
					d.data.age.map((year) => {
						ages[year.age] = year
					});
					for(var i=13; i < 90; i++){
					    if(ages[i] == undefined) ages[i] = { age: i, count: 0 }
					}
					d.data.age = ages.slice(13,91);
					App.demographics = d.data;
					statistics();
				});
			},
			mounted: function() {
				this.generatePartyColorClasses();
			},
			computed: {
				politicians: function() {
					if(this.suggestionDatasets.filter((dataset) => dataset.data.length == 0).length == 0) {
						console.log("Suggestion Engine ready!");
						App.suggestengine = true;
						var returnArr = [];
						this.suggestionDatasets.forEach(function(dataset) {
							returnArr = returnArr.concat(dataset.data);
						})
						return returnArr;
					} else {
						return [];
					}
				},
				advertisersToClassify: function() {
					var result = this.advertisers.filter(function (advertiser) {
						return (
							advertiser.political == '' ||
							(
								advertiser.political == 'true' &&
								advertiser.affiliation == ''
							)
						)
					})
					// console.log("To-do",result);
					return result;
				},
				advertisersClassified: function() {
					var result=  this.advertisers.filter(function (advertiser) {
						return (
							advertiser.political == 'false' ||
							(
								advertiser.political == 'true' &&
								advertiser.affiliation != ''
							)
						)
					})
					// console.log("Classified",result);
					return result.sort((a,b) => b.touchedDate - a.touchedDate );
				},
				politicalAds: function() {
					var App = this;
					var politicalStats = [{
							x: "political",
							y: App.adverts.filter(function(ad) {
									return App.advertisers.find((entity)=> entity.advertiser_id == ad.advertiser_id).political == "true"
								}).length
						}, {
							x: "nonpolitical",
							y: App.adverts.filter(function(ad) {
									return App.advertisers.find((entity)=> entity.advertiser_id == ad.advertiser_id).political != "true"
								}).length
						}
					]
					// console.log(politicalStats)
					return politicalStats;
				},
				partyAds: function() {
					var App = this;
					var partyStats = {}
					App.adverts.forEach(function(ad) {
						var party = App.advertisers.find((entity)=> entity.advertiser_id == ad.advertiser_id).affiliation
						if(party != '') {
							if(partyStats[party] == undefined) partyStats[party] = {x:party, y:0};
							partyStats[party].y++;
							var foundParty = App.parties[1].list.find((p)=>p.id==party);
							partyStats[party].color = foundParty != undefined && foundParty != null ? "#"+foundParty.srgb : 'gray';
						}
						/*else {
							if(partyStats["Neutral"] == undefined) partyStats["Neutral"] = {x:"Neutral", y:0};
							partyStats["Neutral"].y++;
							partyStats["Neutral"].color = "gray"
						}*/
					})
					var result = []
					Object.keys(partyStats).forEach(function(party) {
						result.push(partyStats[party]);
					});
					// console.log(result)
					return result;
				},
				partyColours: function() {
					return this.partyAds.map((party) => party.color);
				}
			},
			methods: {
				save: function() {
					var Component = this;

					$.ajax({
						type: 'post',
						url: "https://who-targets-me-staging.herokuapp.com/advertisers/",
						dataType: 'json',
						data: Component.advertisers,
					    headers: {"Access-Token": "1940d507e36e5034498f24d07d82041208d7d778fabc821cab32b0fc22463edc"}
					}).done(function(data) {
						console.log(data.status);
						console.log("Saved to server",Component.advertisers);
					}).fail(function(data) {
						console.log(data.status);
						console.log("Error saving, try again",Component.advertisers);
					});
				},
				generatePartyColorClasses: function() {
					var css = "";

					this.parties[1].list.forEach(function(party) {
						css +=`
						.party-${party.id} {
							border: 2px solid ${party.srgb ? '#'+party.srgb : 'gray'} !important;
							color: black !important;
						}

						.party-${party.id}.selected {
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

		/* ----
			Visualisations
		*/

		$( window ).resize(() => statistics() );

		function statistics() {
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

			if(generatedMap == false) {
				generatedMap = true;
				var UK_GENERAL_ELECTION_RESULTS_2010 = App.demographics.constituencies

				// Credit to http://bl.ocks.org/timcraft/5866773 for this map
				var base_color = '#2D4357'
				var max_downloads = Math.max.apply(Math,UK_GENERAL_ELECTION_RESULTS_2010.map((o) => o.users))
				var color_scale = d3.scaleLinear().domain([0,max_downloads]).range(['white', base_color])

				var svg = d3.select('#constituencies').append('svg')
				.attr('width', $("#constituencies").width())
				.attr('height', 400);

				var map = UK.ElectionMap(5.2)
				.fill(function(constituency) {
					var thisConstituency = UK_GENERAL_ELECTION_RESULTS_2010.find((o) => o.name == constituency);
					return color_scale(thisConstituency ? thisConstituency.users : 0) || 'white';
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
					var thisConstituency = UK_GENERAL_ELECTION_RESULTS_2010.find((o) => o.name == constituency[2]);
					return constituency[2] + ": " + (thisConstituency ? thisConstituency.users : constituency[2]);
				})
				d3.selectAll(".constituency").on('click', function(constituency) {
					App.selectedConstituency = UK_GENERAL_ELECTION_RESULTS_2010.find((o) => o.name == constituency[2]) || constituency[2];
					d3.event.stopPropagation();
				})

				App.mapGenerated = true;
			}
		}
	}
});
