angular.module("panel", []);

function panel_ctrl() {
	this.branch_params = Branch_Params.get_inst();
}

angular.module("panel").controller("panel_ctrl", [panel_ctrl]);
angular.module("panel").component("panel", {
	bindings: {}
	, controller: [panel_ctrl]
	, controllerAs: "pn"
	, templateUrl: "templates/panel.html"
});