angular.module("app", []);

function panel_ctrl() {
	console.log("panel_ctrl");
}

angular.module("app").controller("panel_ctrl", [panel_ctrl]);
angular.module("app").component("panel", {
	bindings: {}
	, controller: [panel_ctrl]
	, controllerAs: "pn"
	, templateUrl: "templates/panel.html"
});