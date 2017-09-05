if (typeof module === "object" && module.exports) {
	var Branch_Params = require("branch_params");
}

var Branches = (function() {
	var Main = function(init) {
		var main = this;
		
		// initialize
		main.init(init);

		// Pt -- simple x,y container
		main.Pt = function(init) {
			var pt = this;

			pt.check_params(init);

			if (init.pt) {
				pt.x = init.pt.x;
				pt.y = init.pt.y;
			}
			else {
				pt.x = init.x;
				pt.y = init.y;
			}
		};

		// check params will throw an error if unhappy with the Pt's init object, otherwise return nothing
		main.Pt.prototype.check_params = function(init) {
			// we could initialize with another Pt
			if (init.pt != undefined && (init.pt instanceof main.Pt)) {
				return;
			}
			// or with x,y
			if (init.x != undefined && init.y != undefined && (typeof init.x === "number") && (typeof init.y === "number")) {
				return;
			}
			// otherwise error
			throw new Error("problem with Pt init, no or invalid xy or Pt provided.");
		};

		// adds a scalar value to both x and y
		main.Pt.prototype.add = function(val) {
			var pt = this;

			if (typeof val != "number") {
				throw new Error("problem in Pt.add, val passed is not a number. val: " + val);
			}

			pt.x += val;
			pt.y += val;
		};

		// multiples both x and y by a scalar value
		main.Pt.prototype.mul = function(val) {
			var pt = this;

			if (typeof val != "number") {
				throw new Error("problem in Pt.mul, val passed is not a number. val: " + val);
			}

			pt.x = pt.x * val;
			pt.y = pt.y * val;
		};

		// do I want a divide method here?

		main.Pt.prototype.toString = function() {
			var pt = this;

			return pt.x.toString() + "," + pt.y.toString();
		};

		// Node -- a potentially occupied point
		main.Node = function(init) {
			var node = this;

			node.check_params(init);
			node.pt = new main.Pt(init);

			// handle id
			if (init.id != undefined) {
				node.id = init.id;
			}
			else {
				main.id_counter += 1;
				node.id = main.id_counter;
			}

			node.is_target = init.is_target != undefined ? init.is_target : false; // is this how I want to do this?
			node.target_dead = false;
		};

		// check params will throw an error if unhappy with the Node's init object, otherwise return nothing
		main.Node.prototype.check_params = function(init) {
			// we could initialize with a Pt object
			if (init.pt && init.pt instanceof main.Pt) {
				return;
			}
			// or we could have x,y coords
			if (init.x != undefined && (typeof init.x === "number") && init.y != undefined && (typeof init.y === "number")) {
				return;
			}
			// otherwise crash gracelessly
			throw new Error("problem with Node init, neither a Pt nor an x,y provided. Init: " + init);
		};

		main.Node.prototype.draw = function(ctx, color) {
			var node = this;

			main.draw_node(ctx, node, color);
		};

		// returns array of all grid nodes within a given distance of this node
		main.Node.prototype.get_target_nodes_within_distance = function(dist) {
			var node = this, q = []; 

			main.all_target_nodes.forEach(function(nd) {
				var d = main.get_node_distance(node, nd);
				if (d <= dist) {
					q.push(nd);
				}
			});

			return q;
		};
		
		// actually more of a square... 
		main.Node.prototype.get_target_node_cube = function(len) {
			var node = this;
			
			var ret = [], lookup_str;
			var half_len = Math.floor((len/2)/main.grid_unit); // halve and convert to grid units
			var temp, round_x, round_y, x, y, x_rng_low, x_rng_hi, y_rng_low, y_rng_hi;
			var grid_count_x = Math.floor(main.creep_elem.width / main.grid_unit) + 1; 
			var grid_count_y = Math.floor(main.creep_elem.height / main.grid_unit) + 1;
			
			// get rounded grid coords for our center
			round_x = Math.round((node.pt.x) / main.grid_unit);
			round_y = Math.round((node.pt.y) / main.grid_unit);
			
			// get our ranges for each dimension
			temp = Math.floor(round_x - half_len);
			x_rng_low = (temp > 0) ? temp : 0;
			temp = Math.floor(round_y - half_len);
			y_rng_low = (temp > 0) ? temp : 0;
			
			temp = Math.ceil(round_x + half_len);
			x_rng_hi = (temp < grid_count_x) ? temp : grid_count_x;
			temp = Math.ceil(round_y + half_len);
			y_rng_hi = (temp < grid_count_y) ? temp : grid_count_y;
			
			// mixed counting by unit and grid square
			// grab all nodes in the range
			var targ;
			for (x = x_rng_low; x < x_rng_hi; x++) {
				for (y = y_rng_low; y < y_rng_hi; y++) {
					lookup_str = x.toString() + "," + y.toString();
					targ = main.target_nodes_dict[x.toString() + "," + y.toString()];
					if (targ) {
						ret.push(targ);
					}
				}
			}
			
			return ret;
		};

		// Creeper -- creeps up all around
		main.Creeper = function(init) {
			var creep = this;

			creep.check_params(init);

			// handle node location
			creep.nd = main.add_node_for_creeper(init);
			// last loc is a node, it's the creeper's location on the last animation tick
			creep.last_loc = new main.Node({pt: creep.nd.pt});
			creep.last_loc.pt.x = creep.nd.pt.y;
			creep.last_loc.pt.y = creep.nd.pt.y;

			// handle id
			if (init.id != undefined) {
				creep.id = init.id;
			}
			else {
				main.id_counter += 1;
				creep.id = main.id_counter;
			}
			
			// track the number of existing creepers per original creeper spawn event (i.e. user click on canvas)
			// there is a max number of creepers per spawn event *and* a max number of total creepers
			if (init.ancestor_id) {
				creep.ancestor_id = init.ancestor_id;
				main.creeper_parents[init.ancestor_id].cnt += 1;
			}
			else {
				creep.ancestor_id = creep.id;
				main.creeper_parents[creep.id] = {cnt: 1, color: main.branch_params.creeper_color, birthday: Date.now()};
			}
			
			creep.color = main.creeper_parents[creep.ancestor_id].color;
			creep.dead = false;
			creep.birthday = Date.now();
		};

		// check params will throw an error if unhappy with the Creeper's init object, otherwise return nothing
		main.Creeper.prototype.check_params = function(init) {
			var creep = this;
			var good = false;
			
			if (init.ancestor_id === undefined || (typeof init.ancestor_id) === "number") {
				good = true;
			}
			else {
				throw new Error("problem with Creeper init, invalid parent_cnt provided.");
			}

			// we could start with a Pt object
			if (init.pt) {
				if (init.pt instanceof main.Pt) {
					good = true;
				}
				else {
					throw new Error("problem with Creeper init, invalid pt provided.");
				}
			}
			
			// or an x,y is ok too
			if (init.x != undefined || init.y != undefined) {
				if ((typeof init.x === "number") && (typeof init.y === "number")) {
					good = true;
				}
				else {
					throw new Error("problem with Creeper init, invalid x,y provided.");
				}
			}
			
			if (!good) {
				throw new Error("unexpected problem with Creeper init");
			}
		};
		
		main.Creeper.prototype.die = function() {
			var creep = this;
			
			// don't allow creepers to die before they've had 1 second to spread from spawn
			if (creep.ancestor_age() < 1000) {
				return;
			}
			
			// decrement ancestor count
			main.creeper_parents[creep.ancestor_id].cnt -= 1;
			creep.dead = true;
		};
		
		main.Creeper.prototype.ancestor_age = function() {
			var creep = this;
			
			return Date.now() - main.creeper_parents[creep.ancestor_id].birthday;
		};
		
		// v is distance in px per sec
		main.Creeper.prototype.approach = function(v) {
			var creep = this;

			// stop if we're dead
			if (creep.dead) {
				return;
			}

			// die if there are no targets
			if (! main.all_target_nodes.length) {
				creep.die();
				return;
			}
			
			

			// calculate distance to creep
			var dt = main.tick_interval;
			var creep_dist = (v/1000.0) * dt;
			
			// now direction, determined by all targets within a fixed distance
			var accum = new main.Pt({x: 0, y: 0});
			
			// get slice of target map that might be close enough to affect creeper
			var cube = creep.nd.get_target_node_cube(50);
			cube.forEach(function(t) {
				if (! t.is_target) {
					return;
				}
				// first check to see if the creeper should die from encountering the target
				var dist = main.get_node_distance(creep.nd, t);
				if (dist <= 3.0) {
					creep.die();
					t.is_target = false;
					t.draw(main.target_ctx, main.branch_params.background_color);
					return;
				}
				// now check to see if this target is too far away to affect the creeper
				else if (dist > 50.0) {
					return;
				}

				// now accumulate movement 
				var uv = main.dir_with_inv_sq(creep.nd, t);
				accum.x += uv.x;
				accum.y += uv.y;
			});

			// if no targets affected the creeper, die
			if (accum.x === 0 && accum.y === 0) {
				creep.die();
				return;
			}

			// now add repulsion from other creepers
			// this works, but doesn't look as cool -- too much spreading. let's leave it turned off. 
			// remember to add non-0 scaling factor if turning back on
			/*
			main.all_creepers.forEach(function(c) {
				// ignore ourselves
				if (c.id === creep.id) {
					return;
				}

				// direction towards other creeper
				var uv = main.dir_with_inv_sq(creep.nd, c.nd)
				// invert direction
				uv.mul(-1.0);
				// scale down
				uv.mul(0.0);

				accum.x += uv.x;
				accum.y += uv.y;
			});
			*/

			var dir = main.norm(accum);
			dir.mul(creep_dist);
			creep.nd.pt.x += dir.x;
			creep.nd.pt.y += dir.y;
		};

		main.Creeper.prototype.set_last = function() {
			var creep = this;

			creep.last_loc = new main.Node({pt: creep.nd.pt});
			creep.last_loc.pt.x = creep.nd.pt.x;
			creep.last_loc.pt.y = creep.nd.pt.y;
		};

		main.Creeper.prototype.creep = function() {
			var creep = this;
			
			creep.set_last();
			
			// die if we're hitting the edge of the screen
			if (creep.nd.pt.x <= 5 
				|| creep.nd.pt.y <= 5 
				|| creep.nd.pt.x >= (main.creep_elem.width - 5)
				|| creep.nd.pt.y >= (main.creep_elem.height - 5)) {
				
				creep.die();
				return;
			}
			
			creep.split();
			creep.approach(main.branch_params.creep_velocity);
		};

		main.Creeper.prototype.split = function(force_split) {
			var creep = this;
			
			// if force_split was passed, just split
			if (force_split) {
				return main.add_creeper({x: creep.nd.pt.x + .5, y: creep.nd.pt.y + .5, ancestor_id: creep.ancestor_id, velocity: main.branch_params.creep_velocity});
			}
			
			// make sure we're not dead
			if (creep.check_dead()) {
				return;
			}
			
			// don't exceed maximum creepers
			if (main.all_creepers.length > main.branch_params.max_creepers || main.creeper_parents[creep.ancestor_id].cnt > main.branch_params.max_creepers_per_spawn) {
				return;
			}
			
			var r = Math.random();
			r += .1;
			r = !!Math.trunc(r);
			if (r) {
				return main.add_creeper({x: creep.nd.pt.x + .5, y: creep.nd.pt.y + .5, ancestor_id: creep.ancestor_id, velocity: main.branch_params.creep_velocity});
			}
		};

		main.Creeper.prototype.check_dead = function() {
			var creep = this;

			// there's more logic that really belongs here, but it's currently all handled in .approach method
			return creep.dead;
		};

		main.Creeper.prototype.draw = function() {
			var creep = this;

			main.batch_creep_line(creep.last_loc.pt, creep.nd.pt, creep.color);
		};
	};
	
	// initialize everything
	Main.prototype.init = function(init) {
		var main = this;

		// hook up to global branch_params singleton
		main.branch_params = Branch_Params.get_inst();

		// start initializing stuff
		main.creep_elem = init.creep_elem || null;
		main.creep_ctx = main.creep_elem ? main.creep_elem.getContext("2d") : null; 
		main.target_elem = init.target_elem || null;
		main.target_ctx = main.target_elem ? main.target_elem.getContext("2d") : null;

		// counter to give a unique client-side id to every node/creeper/whatever. 
		// didn't wind up using this for anything but I really don't mind having it around
		main.id_counter = 0;

		// keep track of creepers
		main.all_creepers = [];
		
		// maintains counter for each original creeper spawn event (user click on canvas)
		// each creeper split, its parent counter increments, every death it decrements
		main.creeper_parents = {}; 

		// target/attractor nodes
		main.all_target_nodes = [];
		main.target_nodes_dict = {}; // keys are grid coords separated by ",", vals are Node objects
		
		// some constants
		main.grid_unit = main.branch_params.grid_unit;//init.grid_unit || null;

		// for animation lifecycle
		main.last_tick = 0; // time of last animation tick in milliseconds
		main.tick_interval = init.tick_interval;  // animation tick interval in milliseconds
		main.start_time = 0; // time we started the animation -- used to keep creepers from dying for the first few seconds -- NOT USING
		main.finished = true; // if the animation is stopped due to all creepers dying or all targets being eaten (or hasn't started yet)
		main.paused = false; // used to distinguish between animation being deliberately paused vs paused by blur event
		main.int = null; // will be reference to animation interval
		main.batched_creep_lines = {};

		// some ui stuff
		main.click_mode = "place creeper"; // right now this is the only option
		main.anim_running = false;
		main.targets_visible = false;

		// event handlers
		main.creep_elem.addEventListener("click", main.click.bind(main));
		window.addEventListener("blur", main.on_blur.bind(main));
		window.addEventListener("focus", main.on_focus.bind(main));

		// put some Main methods and properties in branch_params for use in angular
		main.branch_params.main_reset = main.reset.bind(main);
		main.branch_params.main_anim_running = main.anim_running;

		// if we define these getter/setters on branch_params here, we'll have access to Main properties 
		// while still keeping things nice and declarative looking on the branch params object for use in angular
		var background_color = "#1c1c1c";
		if (main.branch_params.background_color === undefined) {
			Object.defineProperty(main.branch_params, "background_color", {
				get: function() {
					return background_color;
				},
				set: function(val) {
					background_color = val;
					// redraw with new background color
					main.target_ctx.clearRect(0, 0, main.target_elem.width, main.target_elem.height);
					main.target_ctx.rect(0, 0, main.target_elem.width, main.target_elem.height);
					main.target_ctx.fillStyle = main.branch_params.background_color;
					main.target_ctx.fill();
					// redraw targets if necessary
					if (main.targets_visible) {
						main.draw_targets();
					}
				}
			});
		}

		if (main.branch_params.paused === undefined) {
			Object.defineProperty(main.branch_params, "paused", {
				get: function() {
					return main.paused;
				},
				set: function(val) {
					main.paused = val;
					// if we're pausing
					if (val) {
						main.stop_anim();
					}
					// or if we're unpausing
					else {
						// not going to do this if we're finished instead of just paused
						if (!main.finished) {
							main.start_anim();
						}
					}
				}
			});
		}

		if (main.branch_params.targets_visible === undefined) {
			Object.defineProperty(main.branch_params, "targets_visible", {
				get: function() {
					return main.targets_visible;
				},
				set: function(val) {
					main.targets_visible = val;

					// if we're making the targets visible
					if (val) {
						main.draw_targets();
					}
					// if we're making them invisible
					else {
						main.hide_targets();
					}
				}
			});
		}
	};
	
	// reset everything
	Main.prototype.reset = function() {
		var main = this;

		main.id_counter = 0;
		main.all_creepers = [];
		main.all_target_nodes = [];
		main.last_tick = 0;
		main.start_time = 0;
		main.anim_running = false;
		if (main.int) {
			window.clearInterval(main.int);
		}
		main.int = null;

		main.run();
	};

	// same as main.add_node but does not add to main.nodes_pos_dict
	Main.prototype.add_node_for_creeper = function(init) {
		var main = this;

		var node = new main.Node(init);

		return node;
	};

	Main.prototype.add_target_node = function(init) {
		var main = this;

		var node = new main.Node(init);
		node.is_target = true;

		main.all_target_nodes.push(node);
		
		// get grid coords and store in target_nodes_dict
		var grid_x, grid_y, grid_str;
		grid_x = (node.pt.x - Math.floor(main.grid_unit / 2)) / main.grid_unit;
		grid_y = (node.pt.y - Math.floor(main.grid_unit / 2)) / main.grid_unit;
		grid_str = grid_x + "," + grid_y;
		main.target_nodes_dict[grid_str] = node;
		
		return node;
	};

	Main.prototype.add_creeper = function(init) {
		var main = this;

		var creep = new main.Creeper(init);

		main.all_creepers.push(creep);
		//console.log("creep: ", creep);
		return creep;
	};
	
	Main.prototype.batch_creep_line = function(pt1, pt2, color) {
		var main = this;
		
		if (main.batched_creep_lines[color] == undefined) {
			main.batched_creep_lines[color] = [];
		}
		main.batched_creep_lines[color].push({pt1: pt1, pt2: pt2});
	};
	
	Main.prototype.draw_batched_creep_lines = function() {
		var main = this;
		//console.log(main.batched_creep_lines);
		Object.keys(main.batched_creep_lines).forEach(function(col) {
			main.creep_ctx.shadowColor = col;
			main.creep_ctx.shadowBlur = 10;
			
			main.creep_ctx.strokeStyle = col;
			main.creep_ctx.beginPath();
			main.batched_creep_lines[col].forEach(function(obj) {
				main.creep_ctx.moveTo(obj.pt1.x, obj.pt1.y);
				main.creep_ctx.lineTo(obj.pt2.x, obj.pt2.y);
			});
			main.creep_ctx.stroke();
			main.creep_ctx.shadowColor = "";
			main.creep_ctx.shadowBlur = 0;
		});
		
		main.batched_creep_lines = {};
	};
	
	// draws a line connecting two points
	Main.prototype.draw_line = function(ctx, pt1, pt2, color) {
		var main = this;

		if (! ctx) {
			throw new Error("error in Main.draw_line -- no creep_ctx available");
		}

		ctx.shadowColor = color;
		ctx.shadowBlur = 10;

		ctx.strokeStyle = color;
		ctx.beginPath();
		ctx.moveTo(pt1.x , pt1.y);
		ctx.lineTo(pt2.x, pt2.y);
		ctx.stroke();

		ctx.shadowColor = "";
		ctx.shadowBlur = 0;
	};
	
	

	// draws a small rect on a point
	Main.prototype.draw_point = function(ctx, pt, color) {
		var main = this;

		ctx.fillStyle = color;
		ctx.fillRect(pt.x, pt.y, 2, 2);
	};

	// draws a line connecting two nodes -- calls Main.draw_line
	Main.prototype.draw_connect_nodes = function(ctx, nd1, nd2, color) {
		var main = this;

		main.draw_line(ctx, nd1.pt, nd2.pt, color);
	};

	// draws a small rect on a node's location -- calls Main.draw_point
	Main.prototype.draw_node = function(ctx, nd, color) {
		var main = this;

		main.draw_point(ctx, nd.pt, color);
	};

	// returns Pt
	Main.prototype.dir_unit_vector = function(nd1, nd2) {
		var main = this;

		var diff_x, diff_y, dist, new_x, new_y;

		diff_x = (nd2.pt.x - nd1.pt.x);
		diff_y = (nd2.pt.y - nd1.pt.y);
		dist = main.get_node_distance(nd1, nd2);
		// these guys will be the unit vector pointing in the right direction
		new_x = (diff_x/dist);
		new_y = (diff_y/dist);

		return new main.Pt({x: new_x, y: new_y});
	};

	Main.prototype.dir_with_inv_sq = function(nd1, nd2) {
		var main = this;

		var dist = main.get_node_distance(nd1, nd2);
		var uv = main.dir_unit_vector(nd1, nd2);
		uv.mul((1/(dist * dist)));

		return uv;
	};

	Main.prototype.norm = function(pt) {
		var main = this;

		var hyp = Math.sqrt(pt.x * pt.x + pt.y * pt.y);
		return new main.Pt({x: pt.x / hyp, y: pt.y / hyp});
	};

	// distance between two nodes
	Main.prototype.get_node_distance = function(nd1, nd2) {
		var x_diff = Math.abs(nd1.pt.x - nd2.pt.x);
		var y_diff = Math.abs(nd1.pt.y - nd2.pt.y);
		var dist = Math.sqrt(x_diff * x_diff + y_diff * y_diff);

		return dist;
	};

	// get an array of all nodes sorted by distance from a given node
	// not using this, but let's keep it around
	Main.prototype.get_distance_sorted_nodes = function(nd) {
		var main = this;

		// a and b are nodes, comparing their distance from nd
		function dist_compare(a, b) {
			var a_dist = main.get_node_distance(a, nd);
			var b_dist = main.get_node_distance(b, nd);
			if (a_dist < b_dist) {
				return -1;
			}
			if (a_dist > b_dist) {
				return 1;
			}
			return 0;
		}

		return main.all_target_nodes.sort(dist_compare);
	};

	Main.prototype.rng = function(n1, n2) {
		var main = this;

		var r = Math.random();
		var diff = n2 - n1;
		var temp = Math.round(r * diff);
		return n1 + temp;
	};

	// event handlers
	Main.prototype.click = function(e) {
		var main = this;

		var click_pt, one_creep, clear_list;
		if (main.click_mode) {
			click_pt = main.click_pos(e);
			
			if (main.click_mode === "place creeper") {
				// drop three creepers, save one in a var
				one_creep = main.add_creeper({x: click_pt.x, y: click_pt.y}).split(true).split(true);

				if (! main.anim_running) {
					main.finished = false;
					main.start_anim();
				}
			}
		}
	};
	
	// resumes animation when stopped because window was not active
	Main.prototype.on_focus = function() {
		var main = this;

		if (! main.anim_running && ! main.finished && ! main.paused) {
			main.start_anim();
		}
	};
	
	// pauses animation when window is not focused
	Main.prototype.on_blur = function() {
		var main = this;

		if (main.anim_running) {
			main.stop_anim();
		}
	};

	Main.prototype.click_pos = function(e) {
		var main = this;

		var rect = main.creep_elem.getBoundingClientRect();
		var click_pt = new main.Pt({	x: Math.round((e.clientX - rect.left) / (rect.right - rect.left) * main.creep_elem.width)
										, y: Math.round((e.clientY - rect.top) / (rect.bottom - rect.top) * main.creep_elem.height) });
		return click_pt;
	};
	
	// run once per frame/tick
	Main.prototype.process_creepers = function() {
		var main = this;
		
		// clear out any creepers that died in the last frame
		main.all_creepers = main.all_creepers.filter(function(c) {
			return !c.dead;
		});
		
		// stop processing ticks if all creepers have died
		if (! main.all_creepers.length) {
			main.finished = true;
			main.stop_anim();
		}
		
		// run through every creeper, determine movement, draw them
		main.all_creepers.forEach(function(c) {
			if (! c.dead) {
				c.creep();
				c.check_dead();
				c.draw();
			}
		});
		main.draw_batched_creep_lines();
	};

	Main.prototype.clean_up_targets = function() {
		var main = this;
		
		// clear out dead target nodes
		main.all_target_nodes = main.all_target_nodes.filter(function(nd) {
			return nd.is_target;
		});
		
		// stop animation if all targets are dead
		if (! main.all_target_nodes.length) {
			main.finished = true;
			main.stop_anim();
		}
	};

	Main.prototype.tick = function() {
		var main = this;

		try {
			// process creepers and stuff here
			main.clean_up_targets();
			main.process_creepers();
			
			// finally
			main.last_tick = Date.now();
		}
		catch(err) {
			main.stop_anim();
			throw err;
		}
	};

	Main.prototype.stop_anim = function() {
		var main = this; 

		window.clearInterval(main.int);
		main.int = null;
		main.anim_running = false;
	};

	Main.prototype.start_anim = function() {
		var main = this;

		// don't reset start time if we're only paused
		if (! main.start_time || main.finished) {
			main.start_time = Date.now();
		}
		main.last_tick = Date.now();
		var int;
		main.int = window.setInterval(main.tick.bind(main), main.tick_interval);
		if (main.int) {
			main.anim_running = true;
		}
	};

	Main.prototype.setup_targets = function() {
		var main = this; 

		// setup target grid
		var pos_x = 0, pos_y = 0, nd;
		var grid_count_x = Math.floor(main.creep_elem.width / main.grid_unit) + 1;
		var grid_count_y = Math.floor(main.creep_elem.height / main.grid_unit) + 1;
		var x, y;
		for (x = 0; x < grid_count_x; x++) {
			for (y = 0; y < grid_count_y; y++) {
				pos_x = (x * main.grid_unit) + Math.floor(main.grid_unit / 2);
				pos_y = (y * main.grid_unit) + Math.floor(main.grid_unit / 2);
				if (!! Math.trunc( (Math.random() + main.branch_params.attractor_frequency) )) {
					nd = main.add_target_node({x: pos_x, y: pos_y});
				}
			}
		}

		if (main.targets_visible) {
			main.draw_targets();
		}
	};

	Main.prototype.draw_targets = function() {
		var main = this;

		main.all_target_nodes.forEach(function(t) {
			t.draw(main.target_ctx, "#afafaf");
		});
		main.targets_visible = true;
	};

	Main.prototype.hide_targets = function() {
		var main = this;

		main.all_target_nodes.forEach(function(t) {
			t.draw(main.target_ctx, main.branch_params.background_color);
		});
		main.targets_visible = false;
	};

	// do things
	Main.prototype.run = function() {
		var main = this;
		
		// clear canvases
		main.target_ctx.clearRect(0, 0, main.target_elem.width, main.target_elem.height);
		main.target_ctx.rect(0, 0, main.target_elem.width, main.target_elem.height);
		main.target_ctx.fillStyle = main.branch_params.background_color;
		main.target_ctx.fill();
		main.creep_ctx.clearRect(0, 0, main.creep_elem.width, main.creep_elem.height);
		main.creep_ctx.rect(0, 0, main.creep_elem.width, main.creep_elem.height);
		main.creep_ctx.fillStyle = "transparent";
		main.creep_ctx.fill();

		main.setup_targets();
	};
	
	// expose
	var app;
	return {app: function(init) {
		//return new Main(init);
		if (! app) {
			app = new Main(init);
		}
		else if (init != undefined) {
			app.init(init);
		}
		return app;
	}};
})();

if (typeof module === "object" && module.exports) {
	module.exports = Branches;
}

// polyfill
Math.trunc = Math.trunc || function(x) {
  if (isNaN(x)) {
    return NaN;
  }
  if (x > 0) {
    return Math.floor(x);
  }
  return Math.ceil(x);
};