// singleton to share animation parameters with angular control panel
var Branch_Params = (function() {
	var inst;
	
	function create_inst() {
		var thing = {	what: "it is me"
						, num: 2
						, grid_unit: 7
						, attractor_frequency: 0.3
						, max_creepers: 75
						, creep_velocity: 50
						, creeper_color: "#00ff3f"
						// background_color will be added by defineProperty down below in the Main constructor
					};
		
		return thing;
	}
	
	return {
		get_inst: function() {
			if (! inst) {
				inst = create_inst();
			}
			return inst;
		}
	};
})();

var Branches = (function() {
	var Main = function(init) {
		var main = this;

		// hook up to global branch_params singleton
		main.branch_params = Branch_Params.get_inst();

		// start initializing stuff
		main.creep_elem = init.creep_elem || null;
		main.creep_ctx = main.creep_elem ? main.creep_elem.getContext("2d") : null; 
		main.target_elem = init.target_elem || null;
		main.target_ctx = main.target_elem ? main.target_elem.getContext("2d") : null;

		// counter to give a unique client-side id to every node/creeper/whatever. 
		// didn't wind up using this but I really don't mind having it around
		main.id_counter = 0;

		// keep track of creepers
		main.all_creepers = [];
		//main.creepers_id_dict = {}; // key is id, value is idx in main.all_creepers

		// target/attractor nodes
		main.all_target_nodes = [];

		// some constants
		main.grid_unit = main.branch_params.grid_unit;//init.grid_unit || null;
		main.wobble = init.wobble || 0;
		main.wobble = Math.floor(main.wobble * main.grid_unit);

		// for animation lifecycle
		main.last_tick = 0; // time of last animation tick in milliseconds
		main.tick_interval = init.tick_interval;  // animation tick interval in milliseconds
		main.start_time = 0; // time we started the animation -- used to keep creepers from dying for the first few seconds -- NOT USING
		main.finished = true; // if the animation is stopped due to all creepers dying or all targets being eaten (or hasn't started yet)
		main.paused = false; // used to distinguish between animation being deliberately paused vs paused by blur event
		main.int = null; // will be reference to animation interval

		// some ui stuff
		main.click_mode = "place creeper"; // right now this is the only option
		main.anim_running = false;
		main.targets_visible = false;

		// event handlers
		main.creep_elem.addEventListener("click", main.click.bind(main));
		window.addEventListener("blur", main.on_blur.bind(main));
		window.addEventListener("focus", main.on_focus.bind(main));

		// put some Main methods and properties in branch_params for use in angular
		main.branch_params.main_init = main.init.bind(main);
		main.branch_params.main_anim_running = main.anim_running;

		// if we define these getter/setters on branch_params here, we'll have access to Main properties 
		// while still keeping things nice and declarative looking on the branch params object for use in angular
		var background_color = "#1c1c1c";
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

		//********** object types

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
			if (node.is_target) {
				main.all_target_nodes.push(node);
			}
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

			creep.color = main.branch_params.creeper_color;
			creep.dead = false;
		};

		// check params will throw an error if unhappy with the Creeper's init object, otherwise return nothing
		main.Creeper.prototype.check_params = function(init) {
			var good = false;

			// we could start with a Pt object
			if (init.pt && (init.pt instanceof main.Pt)) {
				return;
			}
			// or an x,y is ok too
			if (init.x != undefined && (typeof init.x === "number") && init.y != undefined && (typeof init.y === "number")) {
				return;
			}

			throw new Error("problem with Creeper init, no Pt or x,y provided. Init: " + init);
		};

		// t_nd is the target node we're approaching, v is distance in px per sec
		main.Creeper.prototype.approach = function(t_nd, v) {
			var creep = this;

			// stop if we're dead
			if (creep.dead) {
				return;
			}

			// die if there are no targets
			if (! main.all_target_nodes.length) {
				creep.dead = true;
				return;
			}

			// calculate distance to creep
			var dt = Date.now() - main.last_tick;
			var creep_dist = (v/1000.0) * dt;

			// now direction, determined by all targets within a fixed distance
			var accum = new main.Pt({x: 0, y: 0});
			main.all_target_nodes.forEach(function(t) {
				if (! t.is_target) {
					return;
				}
				// first check to see if the creeper should die from encountering the target
				var dist = main.get_node_distance(creep.nd, t);
				if (dist <= 3.0) {
					creep.dead = true;
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
				creep.dead = true;
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
			creep.split();
			creep.approach(creep.target, main.branch_params.creep_velocity);
		};

		main.Creeper.prototype.split = function(force_split) {
			var creep = this;

			// don't exceed maximum creepers
			if (main.all_creepers.length > main.branch_params.max_creepers && !force_split) {
				return;
			}
			// ...unless force_split was passed
			if (force_split) {
				return main.add_creeper({x: creep.nd.pt.x + .5, y: creep.nd.pt.y + .5, velocity: main.branch_params.creep_velocity});
			}

			var r = Math.random();
			r += .1;
			r = !!Math.trunc(r);
			if (r) {
				return main.add_creeper({x: creep.nd.pt.x + .5, y: creep.nd.pt.y + .5, velocity: main.branch_params.creep_velocity});
			}
		};

		main.Creeper.prototype.check_dead = function() {
			var creep = this;

			// there's logic that really belongs here, but it's currently all handled in .approach method

			return creep.dead;
		};

		main.Creeper.prototype.draw = function() {
			var creep = this;

			main.draw_connect_nodes(main.creep_ctx, creep.last_loc, creep.nd, creep.color);
		};
	};

	// initialize everything
	Main.prototype.init = function() {
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
		return node;
	};

	Main.prototype.add_creeper = function(init) {
		var main = this;

		var creep = new main.Creeper(init);

		main.all_creepers.push(creep);
		return creep;
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

	// get one dimension of random wobble
	Main.prototype.get_wobble = function() {
		var main = this;

		return Math.floor(Math.random() * (main.wobble * 2)) - main.wobble;
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
				console.log("main.all_creepers: ", main.all_creepers);

				// drop three creepers, save one in a var
				one_creep = main.add_creeper({x: click_pt.x, y: click_pt.y}).split(true).split(true);
				// now clear out grid nodes from the area we're spawning the creepers 
				// so they won't die immediately
				clear_list = one_creep.nd.get_target_nodes_within_distance(40);
				// clear out those nodes we found
				clear_list.forEach(function(nd) {
					nd.is_target = false;
					nd.draw(main.target_ctx, main.branch_params.background_color);
				});

				if (! main.anim_running) {
					main.finished = false;
					main.start_anim();
				}
			}
		}
	};

	Main.prototype.on_focus = function() {
		var main = this;

		if (! main.anim_running && ! main.finished && ! main.paused) {
			console.log("resuming on window focus");
			main.start_anim();
		}
	};

	Main.prototype.on_blur = function() {
		var main = this;

		if (main.anim_running) {
			console.log("pausing on window blur");
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

	Main.prototype.process_creepers = function() {
		var main = this;

		main.all_creepers = main.all_creepers.filter(function(c) {
			return !c.dead;
		});

		if (! main.all_creepers.length) {
			console.log("all creepers dead, stopping");
			main.finished = true;
			main.stop_anim();
		}

		main.all_creepers.forEach(function(c) {
			if (! c.dead) {
				c.creep();
				c.check_dead();
				c.draw();
			}
		});
	};

	Main.prototype.clean_up_targets = function() {
		var main = this;

		main.all_target_nodes = main.all_target_nodes.filter(function(nd) {
			return nd.is_target;
		});

		if (! main.all_target_nodes.length) {
			console.log("all targets dead, stopping");
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
		console.log("animation stopped");

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
			console.log("anim running");
			main.anim_running = true;
		}
	};

	Main.prototype.setup_targets = function() {
		var main = this; 

		// setup grid
		var pos_x = 0, pos_y = 0, nd;
		var grid_count_x = Math.floor(main.creep_elem.width / main.grid_unit);
		var grid_count_y = Math.floor(main.creep_elem.height / main.grid_unit);
		var x, y;
		for (x = 0; x < grid_count_x; x++) {
			for (y = 0; y < grid_count_y; y++) {
				pos_x = (x * main.grid_unit);
				pos_y = (y * main.grid_unit);
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

		console.log("running");
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
	return {app: function(init) {
			return new Main(init);
		}
	};
})();