cross-domain-javascript
=======================

该方案已过时，window.name方式存在一些BUG情况，请使用下文链接技术实现IE低版本跨域处理
（http://www.alloyteam.com/2013/11/the-second-version-universal-solution-iframe-cross-domain-communication/）

javascript通过window.name和window.postMessage实现跨域（兼容浏览器）的双向通信，通信主要是通过callback机制回调模式 .
  
window对象暴露方法名getCrossDomain

crossDomain-rc.js版本主要是解决config.aboutBlank='IE'情况下的，多次使用，（还未进行全面测试）

在可以容忍postMessage也通过about:blank页面进行代理的情况下config.aboutBlank='ALL'，不存在这个问题

现在不完善的地方：
IE情况下window name的形式，和 通过 message事件监听 存在本质上的差异，没有一个消息传递的功能，既一个方法多处响应.
（考虑通过订阅模式，或自定义事件实现）


使用中有问题，欢迎联系，QQ:89415119，谢谢支持。


测试方式:	
安装nodejs, 下载代码，在example文件夹中，运行  fileHttpC.bat  fileHttpM.bat
http://localhost:9099/main.html	 
http://localhost:9099/mainAPI.html
http://localhost:9098/mainClient.html

111
22