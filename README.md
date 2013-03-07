cross-domain-javascript
=======================

javascript通过window.name和window.postMessage实现跨浏览器的双向通信，通信主要是通过callback机制回调支持 .
  
window对象暴露方法名getCrossDomain

crossDomain-rc.js版本主要是解决config.aboutBlank='IE'情况下的，多次使用，（还未进行测试）

在可以容忍postMessage也通过about:blank页面进行代理的情况下config.aboutBlank='ALL'，不存在这个问题


使用中有问题，欢迎联系，QQ:89415119，谢谢支持。


测试方式:	
安装nodejs, 下载代码，在example文件夹中，运行  fileHttpC.bat  fileHttpM.bat
http://localhost:9099/main.html	 http://localhost:9099/mainAPI.html	http://localhost:9098/mainClient.html