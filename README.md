cross-domain-javascript
=======================

javascript cross domain, in IE,chrome,firefox,opera,safari


javascript通过window.name和window.postMessage实现跨浏览器的双向通信，通信主要是通过callback机制，回调支持
有3个版本，表示about:blank的支持情况
1.crossDomain-no-about-blank.js，没有about:blank代理页面
	直接修改 main window 的window.name(IE),或监听main window的postMessage事件
	(如果其他跨域支持脚本，IE版本通过name实现，存在问题)
2.crossDomain-IE-about-blank.js，IE情况下使用about:blank代理页面
	修改about:blank页的name,监听main window的postMessage事件
	(该版本，应该能适用大部分的情况)
3.crossDomain-all-about-blank.js，所有情况下都通过about:blank代理页面
	修改 about:blank 的window.name(IE),或监听about:blank的postMessage事件 
	(通过about:blank实现main.window的绝对安全)

后期考虑：
    考虑2个第3方通过该方式提供API，公用about:blank，postMessage监听，减少页面的iframe个数

有问题，欢迎指正，谢谢支持
