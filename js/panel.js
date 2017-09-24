angular.module("panel", ["slider-color-picker"]);

function panel_ctrl() {
	var self = this;
	self.branch_params = Branch_Params.get_inst();
}

angular.module("panel").controller("panel_ctrl", [panel_ctrl]);
angular.module("panel").component("panel", {
	bindings: {}
	, controller: [panel_ctrl]
	, controllerAs: "pn"
	, templateUrl: "html/templates/panel.html"
});
