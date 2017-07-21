angular.module("app", []);

function panel_ctrl() {
	this.branch_params = Branch_Params.get_inst();
	
	
}

angular.module("app").controller("panel_ctrl", [panel_ctrl]);
angular.module("app").component("panel", {
	bindings: {}
	, controller: [panel_ctrl]
	, controllerAs: "pn"
	, templateUrl: "templates/panel.html"
});