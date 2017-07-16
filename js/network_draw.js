var Main = function(init) {
	var main = this;
	
	// put something up here to validate all these init properties
	main.elem = init.elem || null;
	main.ctx = main.elem ? main.elem.getContext("2d") : null; 
	
	main.id_counter = 0;
	
	// keep track of nodes
	main.all_grid_nodes = [];
	main.nodes_id_dict = {}; // key is id, value is idx in main.all_grid_nodes -- is this useful?
	main.nodes_pos_dict = {}; // key is x,y, value is idx in main.all_grid_nodes. does not contain creeper nodes
	
	// keep track of creepers
	main.all_creepers = [];
	main.creepers_id_dict = {}; // key is id, value is idx in main.all_creepers
	
	// target/attractor nodes
	main.all_target_nodes = [];
	
	// some constants
	main.grid_unit = init.grid_unit || null;
	main.wobble = init.wobble || 0;
	main.wobble = Math.floor(main.wobble * main.grid_unit);
	
	// for animation
	main.last_tick = 0; // time of last animation tick in milliseconds
	main.tick_interval = init.tick_interval;  // animation tick interval in milliseconds
	
	// target(s) for creepers -- should be a Node
	main.init_creep_target = init.init_creep_target;
	// first creeper placed with mouse
	main.init_creeper = null;
	
	// container to hold objects created when the user clicks
	main.click_container = {};
	
	// some ui stuff
	main.click_mode = "place creeper"; // options are "place creeper" and "place target"
	main.anim_running = false;
	// click listener
	/*
	main.elem.addEventListener("click", function(e) {
		//console.log("click: ", e);
		var rect = main.elem.getBoundingClientRect();
		var click_pt = new main.Pt({	x: Math.round((e.clientX - rect.left) / (rect.right - rect.left) * main.elem.width)
										, y: Math.round((e.clientY - rect.top) / (rect.bottom - rect.top) * main.elem.height) });
		
		console.log("click_pt: ", click_pt);
		var click_nd = main.add_grid_node({pt: click_pt});
		click_nd.draw("#00ff2e");
	});
	*/
	
	main.elem.addEventListener("click", main.click.bind(main));
	
	//********** object types
	
	// Pt -- simple x,y container
	main.Pt = function(init) {
		var pt = this;
		
		if (init.x === undefined || init.y === undefined || (typeof init.x != "number") || (typeof init.y != "number")) {
			throw new Error("problem with Pt init, no xy provided. Init: ", init);
		}
		
		pt.x = init.x;
		pt.y = init.y;
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
			throw new Error("problem in Pt.add, val passed is not a number. val: " + val);
		}
		
		pt.x = pt.x * val;
		pt.y = pt.y * val;
	};
	
	// do I want a divide here?
	
	main.Pt.prototype.toString = function() {
		var pt = this;
		
		return pt.x.toString() + "," + pt.y.toString();
	};
	
	// Node -- a potentially occupied point in the graph
	main.Node = function(init) {
		var node = this;
		
		// check params
		// we could initialize with a Pt
		if (init.pt && init.pt instanceof main.Pt) {
			node.raw_pt = init.pt;
		}
		// or we could have x,y coords
		else if (init.x != undefined && (typeof init.x === "number") && init.y != undefined && (typeof init.y === "number")) {
			node.raw_pt = new main.Pt({x: init.x, y: init.y});
		}
		// otherwise crash gracelessly
		else {
			throw new Error("problem with Node init, neither a Pt nor an xy provided. Init: " + init);
		}
		
		// handle id
		if (init.id != undefined) {
			node.id = init.id;
		}
		else {
			main.id_counter += 1;
			node.id = main.id_counter;
		}
		
		//node.raw_pt = init.pt; // where the node 'really' is
		node.pt = new main.Pt({x: node.raw_pt.x + main.get_wobble(), y: node.raw_pt.y + main.get_wobble()}); // where the node will be drawn
		node.is_target = init.is_target != undefined ? init.is_target : false; // is this how I want to do this?
		if (node.is_target) {
			main.all_target_nodes.push(node);
		}
	};
	
	main.Node.prototype.draw = function(color) {
		var node = this;
		
		main.draw_node(node, color);
	};
	
	main.Node.prototype.rewobble = function() {
		var node = this;
		
		node.pt.x = node.raw_pt.x + main.get_wobble();
		node.pt.y = node.raw_pt.y + main.get_wobble();
	};
	
	// returns array of all grid nodes within a given distance of this node
	main.Node.prototype.get_nodes_within_distance = function(dist) {
		var node = this, q = []; 
		
		main.all_grid_nodes.forEach(function(nd) {
			var d = main.get_node_distance(node, nd);
			if (d <= dist) {
				q.push(nd);
			}
		});
		
		return q;
	};
	
	// marks and returns array of randomly selected grid nodes within a given distance of this node
	main.Node.prototype.pick_target_nodes = function(dist) {
		var node = this;
		
		var close = node.get_nodes_within_distance(dist), q = [];
		close.forEach(function(nd) {
			var d = main.get_node_distance(node, nd);
			var keep = !!Math.round(Math.random()); // gets us a random boolean
			// only add to array if the node is not already a target
			if (keep && ! nd.is_target) {
				nd.is_target = true;
				q.push(nd);
			}
		});
		
		return q;
	};
	
	main.Node.prototype.make_target_nodes = function(dist) {
		var node = this;
		
		var q = [];
	};
	
	// Creeper -- creeps up all around
	main.Creeper = function(init) {
		var creep = this;
		
		//console.log("creep init: ", init);
		// handle location -- init should contain a pt, or an x,y 
		// we will construct a Node for it here so we can keep it out of the node position dict
		if (init.pt && (init.pt instanceof main.Pt)) {
			creep.nd = main.add_node_for_creeper(init.pt);
		}
		else if (init.x != undefined && (typeof init.x === "number") && init.y != undefined && (typeof init.y === "number")) {
			//console.log("here");
			creep.nd = main.add_node_for_creeper(init);
			//console.log("creep.nd: ", creep.nd);
		}
		else {
			throw new Error("problem with Creeper init, no Pt or x,y provided. Init: " + init);
		}
		// last loc is a node, it's the creeper's location on the last animation tick
		// note that we have to manually set the pt.x and pt.y or it'll get a different wobble
		creep.last_loc = new main.Node({pt: creep.nd.raw_pt});
		creep.last_loc.pt.x = creep.nd.pt.y;
		creep.last_loc.pt.y = creep.nd.pt.y;
		
		
		// init.target, if provided, should be an existing Node
		if (init.target && (! init.target || (!(init.target instanceof main.Node)))) {
			throw new Error("problem with Creeper init, target not provided or wrong type. Init: " + init);
		}
		creep.target = init.target || null;;
		// init.velocity, if provided, should be a number. indicates distance in px per sec
		if ((init.velocity != undefined) && (typeof init.velocity) != "number") {
			throw new Error("problem with Creeper init, velocity not provided or wrong type. Init: " + init);
		}
		creep.init_velocity = init.velocity != undefined ? init.velocity : 50;
		
		// handle id
		if (init.id != undefined) {
			creep.id = init.id;
		}
		else {
			main.id_counter += 1;
			creep.id = main.id_counter;
		}
		
		//creep.nd = init.nd;
		creep.color = init.color || "#b00000";
		creep.dead = false;
	};
	
	// t_nd is the target node we're approaching, v is distance in px per sec
	main.Creeper.prototype.approach = function(t_nd, v) {
		var creep = this;
		
		// calculate distance
		var dt = Date.now() - main.last_tick;
		var creep_dist = (v/1000.0) * dt;
		
		// get direction -- this is for one target
		/*
		var uv = main.dir_unit_vector(creep.nd, t_nd);
		
		uv.mul(creep_dist);
		creep.nd.raw_pt.x += uv.x;
		creep.nd.raw_pt.y += uv.y;
		creep.nd.rewobble();
		*/
		
		// try for all targets
		var accum = new main.Pt({x: 0, y: 0});
		//console.log("main.all_target_nodes: ", main.all_target_nodes);
		main.all_target_nodes.forEach(function(t) {
			var uv = main.dir_unit_vector(creep.nd, t);
			accum.x += uv.x;
			accum.y += uv.y;
		});
		
		var dir = main.norm(accum);
		dir.mul(creep_dist);
		creep.nd.raw_pt.x += dir.x;
		creep.nd.raw_pt.y += dir.y;
		creep.nd.rewobble();
		
	};
	
	main.Creeper.prototype.set_last = function() {
		var creep = this;
		
		creep.last_loc = new main.Node({pt: creep.nd.raw_pt});
		// note that we have to manually set the pt.x and pt.y or it'll get a different wobble
		creep.last_loc.pt.x = creep.nd.pt.x;
		creep.last_loc.pt.y = creep.nd.pt.y;
	};
	
	main.Creeper.prototype.creep = function() {
		var creep = this;
		
		//console.log("creeper: ", creep);
		creep.set_last();
		creep.approach(creep.target, creep.init_velocity);
	};
	
	main.Creeper.prototype.check_dead = function() {
		var creep = this;
		
		// need to fix this to check for any nearby node
		//var dist = main.get_node_distance(creep.nd, creep.target);
		//if (dist < 10.0) {
		//	creep.dead = true;
		//}
		
		return creep.dead;
	};
	
	main.Creeper.prototype.draw = function() {
		var creep = this;
		
		//creep.nd.draw(creep.color);
		main.draw_connect_nodes(creep.last_loc, creep.nd, creep.color);
	};
};

// adds a static map node
Main.prototype.add_grid_node = function(init) {
	var main = this;
	
	// init may have a Pt or an x and y
	var node = new main.Node(init);
	
	main.all_grid_nodes.push(node);
	main.nodes_id_dict[node.id] = main.all_grid_nodes.length - 1;
	main.nodes_pos_dict[node.raw_pt.toString()] = main.all_grid_nodes.length - 1;
	return node;
};

// same as main.add_node but does not add to main.nodes_pos_dict
Main.prototype.add_node_for_creeper = function(init) {
	var main = this;
	
	var node = new main.Node(init);
	
	main.all_grid_nodes.push(node);
	main.nodes_id_dict[node.id] = main.all_grid_nodes.length - 1;
	return node;
};

Main.prototype.add_target_node = function(init) {
	var main = this;
	
	var node = new main.Node(init);
	
	main.all_target_nodes.push(node);
	return node;
};

Main.prototype.add_creeper = function(init) {
	var main = this;
	
	var creep = new main.Creeper(init);
	
	main.all_creepers.push(creep);
	main.creepers_id_dict[creep.id] = main.all_creepers.length - 1;
	return creep;
};

// draws a line connecting two points
Main.prototype.draw_line = function(pt1, pt2, color) {
	var main = this;
	
	if (! main.ctx) {
		throw new Error("error in Main.draw_line -- no ctx available");
	}
	
	main.ctx.strokeStyle = color;
	main.ctx.beginPath();
	main.ctx.moveTo(pt1.x , pt1.y);
	main.ctx.lineTo(pt2.x, pt2.y);
	main.ctx.stroke();
};

// draws a small rect on a point
Main.prototype.draw_point = function(pt, color) {
	var main = this;
	
	main.ctx.fillStyle = color;
	main.ctx.fillRect(pt.x, pt.y, 2, 2);
};

// draws a line connecting two nodes -- calls Main.draw_line
Main.prototype.draw_connect_nodes = function(nd1, nd2, color) {
	var main = this;
	
	main.draw_line(nd1.pt, nd2.pt, color);
};

// draws a small rect on a node's location -- calls Main.draw_point
Main.prototype.draw_node = function(nd, color) {
	var main = this;
	
	main.draw_point(nd.pt, color);
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
	
	diff_x = (nd2.raw_pt.x - nd1.raw_pt.x);
	diff_y = (nd2.raw_pt.y - nd1.raw_pt.y);
	dist = main.get_node_distance(nd1, nd2);
	// these guys will be the unit vector pointing in the right direction
	new_x = (diff_x/dist);
	new_y = (diff_y/dist);
	
	return new main.Pt({x: new_x, y: new_y});
};

Main.prototype.norm = function(pt) {
	var main = this;
	
	var hyp = Math.sqrt(pt.x * pt.x + pt.y * pt.y);
	return new main.Pt({x: pt.x / hyp, y: pt.y / hyp});
};

// not using this
// returns the next node on a path from nd1 to nd2... sort of, rethinking this
Main.prototype.approach_by_grid_step = function(nd1, nd2) {
	var main = this;
	
	/*
	var diff_x = (nd2.raw_pt.x - nd1.raw_pt.x);
	var diff_y = (nd2.raw_pt.y - nd1.raw_pt.y);
	var dist = main.get_node_distance(nd1, nd2);
	console.log("diff_x: ", diff_x);
	console.log("diff_y: ", diff_y);
	console.log("dist: ", dist);
	//var thing = Math.sqrt(diff_x * diff_x + diff_y * diff_y);
	//console.log("thing: ", thing);
	
	// these guys will be the unit vector pointing in the right direction
	var new_x = (diff_x/dist);
	var new_y = (diff_y/dist);
	*/
	
	var uv = main.dir_unit_vector(nd1, nd2);
	var new_x = uv.x;
	var new_y = uv.y;
	
	var ang = (Math.atan2(new_y, new_x) * 180.0) / Math.PI;
	//console.log("ang: ", ang);
	
	//console.log("new_x: ", new_x, "new_y: ", new_y);
	
	new_x = Math.round(new_x);
	new_y = Math.round(new_y);
	//console.log("Now ---- new_x: ", new_x, "new_y: ", new_y);
	
	new_x = nd1.raw_pt.x + (new_x * main.grid_unit);
	new_y = nd1.raw_pt.y + (new_y * main.grid_unit);
	
	new_x = Math.floor(new_x/main.grid_unit) * main.grid_unit;
	new_y = Math.floor(new_y/main.grid_unit) * main.grid_unit;
	
	//console.log("nd1: ", nd1.raw_pt, " nd2: ", nd2.raw_pt, " new: ", new main.Pt({x: new_x, y: new_y}));
	
	var new_node = main.add_grid_node({x: new_x, y: new_y});
	//main.draw_node(new_node, "#00ff11");
	new_node.draw("#00ff11");
	
	return new_node;
};



// distance between two nodes
Main.prototype.get_node_distance = function(nd1, nd2) {
	var x_diff = Math.abs(nd1.raw_pt.x - nd2.raw_pt.x);
	var y_diff = Math.abs(nd1.raw_pt.y - nd2.raw_pt.y);
	var dist = Math.sqrt(x_diff * x_diff + y_diff * y_diff);
	
	//console.log("x_diff: ", x_diff, " y_diff: ", y_diff, " dist: ", dist);
	return dist;
};

// get an array of all nodes sorted by distance from a given node
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
	
	return main.all_grid_nodes.sort(dist_compare);
};

Main.prototype.rng = function(n1, n2) {
	var main = this;
	
	var r = Math.random();
	var diff = n2 - n1;
	var temp = Math.round(r * diff);
	return n1 + temp;
};

Main.prototype.click = function(e) {
	var main = this;
	
	var click_pt, click_thing;
	if (main.click_mode) {
		click_pt = main.click_pos(e), click_thing;

		if (main.click_mode === "place creeper") {
			click_thing = main.add_creeper({x: click_pt.x, y: click_pt.y});
			click_thing.dead = true;
			main.click_container.init_creeper = click_thing;
			main.click_mode = "place many targets";
		}
		else if (main.click_mode === "place target") {
			click_thing = new main.Node({x: click_pt.x, y: click_pt.y});
			main.click_container.init_creeper.target = click_thing;
			main.click_container.init_creeper.dead = false;
			main.click_mode = "place creeper";
			main.start_anim();
		}
		else if (main.click_mode === "place many targets") {
			// just to see...
			click_thing = main.add_target_node({x: click_pt.x, y: click_pt.y});
			var q = click_thing.pick_target_nodes(75);
			q.forEach(function(nd) {
				main.all_target_nodes.push(nd);
				nd.draw("#00ff2e");
			});
			main.click_container.init_creeper.dead = false;
			if (! main.anim_running) {
				main.start_anim();
			}
		}
	}
	//console.log("main: ", main);
	//console.log("main.click_mode: ", main.click_mode);
};

Main.prototype.click_pos = function(e) {
	var main = this;
	
	var rect = main.elem.getBoundingClientRect();
	var click_pt = new main.Pt({	x: Math.round((e.clientX - rect.left) / (rect.right - rect.left) * main.elem.width)
									, y: Math.round((e.clientY - rect.top) / (rect.bottom - rect.top) * main.elem.height) });
	return click_pt;
};

Main.prototype.process_creepers = function() {
	var main = this;
	
	main.all_creepers.forEach(function(c) {
		if (! c.dead) {
			//console.log("not dead");
			c.creep();
			c.check_dead();
			c.draw();
		}
	});
};

Main.prototype.tick = function() {
	var main = this;
	//console.log("main: ", main);
	
	try {
		// process creepers and stuff here
		main.process_creepers();

		// finally
		main.last_tick = Date.now();
	}
	catch(err) {
		window.clearInterval(main.int);
		throw err;
	}
};

Main.prototype.start_anim = function() {
	var main = this;
	
	main.last_tick = Date.now();
	var int;
	main.int = window.setInterval(main.tick.bind(main), main.tick_interval);
	if (main.int) {
		console.log("anim running");
		main.anim_running = true;
	}
	/*
	try {
		int = window.setInterval(main.tick.bind(main), main.tick_interval);
	}
	catch(e) {
		window.clearInterval(int);
	}
	*/
};



// do things
Main.prototype.run = function() {
	var main = this;
	
	console.log("running");
	
	// setup grid
	var pos_x = 0, pos_y = 0, nd;
	var grid_count_x = Math.floor(main.elem.width / main.grid_unit);
	var grid_count_y = Math.floor(main.elem.height / main.grid_unit);
	var x, y;
	for (x = 0; x < grid_count_x; x++) {
		for (y = 0; y < grid_count_y; y++) {
			pos_x = (x * main.grid_unit);
			pos_y = (y * main.grid_unit);
			//console.log("pos_x: ", pos_x);
			nd = main.add_grid_node({x: pos_x, y: pos_y});
			//main.draw_node(nd, "#afafaf");
			nd.draw("#afafaf");
		}
	}
	
	// setup creepers
	//var creep_target = main.all_grid_nodes[1645];
	//var creep = main.add_creeper({x: 50, y: 50, target: creep_target, velocity: 50});
	//creep_target.draw("#ff0033");
	
	//main.start_anim();
	
	//main.get_distance_sorted_nodes(main.all_grid_nodes[20]);
	//main.draw_node(main.all_grid_nodes[65], "#ff0033");
	//main.draw_node(main.all_grid_nodes[837], "#ff0033");
	
	/*
	main.all_grid_nodes[65].draw("#ff0033");
	main.all_grid_nodes[837].draw("#ff0033");
	
	var nd1 = main.all_grid_nodes[65], nd2 = main.all_grid_nodes[837];
	//main.approach_by_grid_step(nd1, nd2);
	
	
	var c;
	for (c = 0; c < 20; c++) {
		nd1 = main.approach_by_grid_step(nd1, nd2);
	}
	*/
	
	/*
	while (pos_x < main.elem.width) {
		pos_x += (main.grid_unit + (Math.floor(Math.random() * (main.wobble * 2)) - main.wobble));
		while (pos_y < main.elem.height) {
			pos_y += (main.grid_unit + (Math.floor(Math.random() * (main.wobble * 2)) - main.wobble));
			nd = main.add_grid_node({x: pos_x, y: pos_y});
			//main.draw_node(nd);
			nd.draw();
		}
		
	}
	*/
	
	// start animating
	/*
	window.setInterval(function() {
		console.log("interval");
	}, 1000);
	*/
};


var app;
window.addEventListener("load", function() { 
	var elem = document.getElementById("main_canvas");
	var grid_unit = 10;
	var wobble = 0.1;
	
	app = new Main({elem: elem, grid_unit: grid_unit, wobble: wobble, tick_interval: 33});
});

