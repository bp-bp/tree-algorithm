// singleton to share animation parameters with angular control panel
var Branch_Params = (function() {
	var inst;
	
	function create_inst() {
		var thing = {	what: "it is me"
						, num: 2
						, grid_unit: 7
						, attractor_frequency: 0.7
						, max_creepers: 400
						, max_creepers_per_spawn: 50
						, creep_velocity: 50
						, creeper_color: "#5ff442"
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

if (typeof module === "object" && module.exports) {
	module.exports = Branch_Params;
}
