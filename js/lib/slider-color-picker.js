if (typeof module === "object" && module.exports) {
	var Color = require("color-js");
	var angular = require("angular");
}
else {
	var Color = net.brehaut.Color;
}

angular.module("slider-color-picker", []);

function scp_ctrl($element) {
	var self = this;
	self.visible = false;
	
	self.toggle_visible = function() {
		console.log("ng-click");
		self.visible = !self.visible;
	};
	
	self.$onInit = function() {
		self.color = Color(self.ngModel);
		self.color = self.color;
		
		var red_input = angular.element($element[0].querySelector("#scp-red-input"));
		var green_input = angular.element($element[0].querySelector("#scp-green-input"));
		var blue_input = angular.element($element[0].querySelector("#scp-blue-input"));
		var indicator = angular.element($element[0].querySelector("#scp-indicator"));
		var ext_indicator = angular.element($element[0].querySelector("#scp-ext-indicator"));
		indicator.css("background-color", self.color.toString());
		ext_indicator.css("background-color", self.color.toString());
		
		
		red_input[0].value = self.color.getRed();
		green_input[0].value = self.color.getGreen();
		blue_input[0].value = self.color.getBlue();
		self.red_val = self.color.getRed();
		self.green_val = self.color.getGreen();
		self.blue_val = self.color.getBlue();
		
		self.red_change = function() {
			self.color = self.color.setRed(self.red_val);
			indicator.css("background-color", self.color.toString());
			ext_indicator.css("background-color", self.color.toString());
			self.ngModel = self.color.toString();
		};
		
		self.green_change = function() {
			self.color = self.color.setGreen(self.green_val);
			indicator.css("background-color", self.color.toString());
			ext_indicator.css("background-color", self.color.toString());
			self.ngModel = self.color.toString();
		};
		
		self.blue_change = function() {
			self.color = self.color.setBlue(self.blue_val);
			indicator.css("background-color", self.color.toString());
			ext_indicator.css("background-color", self.color.toString());
			self.ngModel = self.color.toString();
		};
	};
	
}
angular.module("slider-color-picker").controller("scp_ctrl", ["$element"]);
angular.module("slider-color-picker").component("sliderColorPicker", {
	bindings: {ngModel: "="}
	, controller: ["$element", scp_ctrl]
	, controllerAs: "scp"
	, templateUrl: "html/templates/slider_color_picker.html"
});
