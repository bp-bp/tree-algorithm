
var branches_app;
window.addEventListener("load", function() { 
	var creep_elem = document.getElementById("creep_canvas");
	var target_elem = document.getElementById("target_canvas");
	
	var ww = window.innerWidth;
	var client_width = document.body.clientWidth;
	var client_height = document.body.clientHeight;
	if (client_width < 650) {
		creep_elem.width = (client_width - 2);
		target_elem.width = (client_width - 2);
	}
	if (client_height < 650) {
		creep_elem.height = (Math.floor(client_height * 0.8));
		target_elem.height = (Math.floor(client_height * 0.8));
	}
	
	var branch_params = Branch_Params.get_inst();
	branches_app = new Branches.app({creep_elem: creep_elem, target_elem: target_elem, grid_unit: branch_params.grid_unit, wobble: 0, tick_interval: 33});
});
