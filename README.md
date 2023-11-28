# js.notes（第一版）

#####初学js随记
-----

##闭包

> 闭包是指函数有自由独立的变量。换句话说，定义在闭包中的函数可以“记忆”它创建时候的环境。

	function makeFunc() {
		var name = "Mozilla";
		function displayName() {
			alert(name);
		}
		return displayName;
	}
	
	var myFunc = makeFunc();
	myFunc();

**闭包** 是一种特殊的对象。它由两部分构成：函数，以及创建该函数的环境。环境由闭包创建时在作用域中的任何局部变量组成。在上面的例子中，`myFunc` 是一个**闭包**，由 `displayName` 函数和闭包创建时存在的 `"Mozilla"` 字符串形成。[阅读原文](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Closures)
