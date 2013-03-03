(function(win, doc, undefined) {
			
	var slice = Array.prototype.slice;
	var urlReg = /^[^:]+:\/*[^\/]+/;
	var _sport = !!win.postMessage ? 'postMessage' : 'name';
	var hasOwn = Object.prototype.hasOwnProperty;
	
	//============================公共函数===========================
	var util = {
		addEvent: doc.attachEvent ? function(element, event, fn) {
			element.attachEvent('on' + event, fn);
		} : function(element, event, fn) {
			element.addEventListener(event, fn, false);
		},
		isSameDomain: function (urlA, urlB) {//简单写的，可能有误
			var strA = urlA.match(urlReg)[0].replace(/:80$/,'').replace(/:\/+/,''),strB = urlB.match(urlReg)[0].replace(/:80$/,'').replace(/:\/+/,'');
			return  strA == strB;
		},
		getCurrentScript: function () {//来自正妹的mass框架
			if (doc.currentScript) { 
				return doc.currentScript.src;
			}
			var stack;
			try {
				throw new Error();
			} catch (e) {
				stack = e.stack;
				if (!stack && win.opera) {
					stack = (String(e).match(/of linked script \S+/g) || []).join(" ");
				}
			}
			if (stack) {
				stack = stack.split(/[@ ]/g).pop(); 
				stack = stack[0] === "(" ? stack.slice(1, -1) : stack;
				return stack.replace(/(:\d+)?:\d+$/i, "");
			}
			var nodes = doc.getElementsByTagName("script");
			for (var i = 0, node; node = nodes[i++]; ) {
				if (node.readyState === "interactive") {
					return node.src;
				}
			}
		},
	 /**
	  * win动态添加script结点，载入后回调
	  * @param {window} win window对象
	  * @param {String} url script的引用路径
	  * @param {Function} callback？ script加载完成，回调方法
	  * @return {Node} script结点
	  */
		scriptLoad : function(win, url, callback) {
			var head;
			var doc = win.document;
			var node = doc.createElement("script");
			node.type = "text/javascript";
			head = doc.getElementsByTagName("head")[0];
			if(!head) {
				head = doc.createElement("head");
				doc.documentElement.appendChild(head);
			}
			node.src = url;
			head.appendChild(node);
			if(!!callback) {
				node.onload = node.onerror = node.onreadystatechange = function() {
					if(/loaded|complete|undefined/.test(node.readyState)) {
						node.onload = node.onerror = node.onreadystatechange = null;
						head.removeChild(node)
						node = undefined;
						callback();
					}
				};
			}
			return node;
		},
		 /**
		  * 动态添加ifrme结点，设置url，载入后回调
		  * @param {String} url ifrme地址
		  * @param {Function} callback？ifrme加载完成，回调方法
		  * @return {Node} ifrme结点
		  */
		iframeLoad : function(url, callback) {
			var frame = doc.createElement("iframe");
			if(!!url) {
				frame.src = url;
			}
			frame.style.cssText = "position:absolute;left:-2000px;width:1px;height:1px;";
			if(!!callback) {
				util.addEvent(frame, 'load', callback);
			}
			doc.body.appendChild(frame);
			return frame;
		},
	 /**
	  * 对象obj的name方法重写，增加setReady方法
	  *     在调用setReady之前，调用函数，存储参数入list，
	  *     在调用setReady时，批量执行list存储的参数(可延迟执行)
	  *     在调用setReady之后，调用函数，立即执行，
	  * @param {Object} obj 对象
	  * @param {String} name 方法的对应属性名字
	  * @return {Node} ifrme结点
	  */
		runReady : function(obj, name) {
			var fun = obj[name];
			var _ready = false;
			var _list = [];
			obj[name] = function() {
				if(_ready == false) {
					_list.push(arguments);
				} else {
					fun.apply(obj, arguments);
				}
			};
			obj[name].setReady = function() {
				if(_ready == false) {
					_ready = true;
					while(_list.length > 0) {
						fun.apply(obj, _list.shift());
					}
				}
			};
		}
	};
	
	
	//============================通信对象===========================
	function message() {
		//底层通信对象
		var hash = '';
		var message = {
			sport : _sport,
			send : _sport == 'name'? function(data) {//send(编码)
				this.proxy.name = data;
			}:  function(data) {
				this.proxy.postMessage(data, '*');
			},
			get : function(data) {//解码,get(解码),绑定该get
				alert(data);
				this.child.get(data);
			},
			setProxy: function (proxy) {
				message.proxy = proxy;
			},
			bindMessage: function () {
				if (_sport == 'postMessage') {
					util.addEvent(win,'message', function (e) {
						message.get(e.data);
					})
				} else {
					setInterval(function() {
						if(win.name !== hash) {
							hash = win.name;
							message.get(hash);
						}
					}, 50);
				}
			},
			params2str: function () {
				return slice.call(arguments,0).join('<{PA}>');
			},
			str2params: function (str) {
				return str.split('<{PA}>');
			},
			dealparams: function (params2str, str2params) {
				message.params2str = params2str;
				message.str2params = str2params;
			}
		};
		message.bindMessage();
		return message;
	};
		
	function ieMessage (message, ieSeparator) {
		ieSeparator || (ieSeparator = ['<{IE}>', '{<IE>}']);
		var uuid = 0;
		var sendMap = {};//主动发出的消息
		var cancelMap = {};//正在处理中的数据，通知不需要再传送
		
		function push(ary, obj) {
			//obj的值，添加到ary数组中
			for(var i in obj) {
				if(obj.hasOwnProperty(i)) {
					ary.push(obj[i]);
				}
			}
			return ary;
		}
		
		function postStr() {
			var ary = [];
			push(ary, sendMap);
			push(ary, cancelMap);
			return ary.join(ieSeparator[1]);
		}
		
		var fun = function () {};
		fun.prototype = message;
		var resultObj = new fun();
		message.child = resultObj;
		
		resultObj.ieSeparator = ieSeparator;//可以理解为只读属性
		resultObj.send = function (opt, uid) {
			//  12345
			//=>S<{IE}>0<{IE}>12345
			//  67890
			//=>S<{IE}>0<{IE}>12345{<IE>}S<{IE}>1<{IE}>67890
			//  C,0
			//=>S<{IE}>0<{IE}>12345{<IE>}S<{IE}>1<{IE}>67890{<IE>}C<{IE}>0
			var data;
			if (opt == 'C' && !!uid){//发送“取消发送”的消息
				cancelMap[uid] = [opt,uid].join(this.ieSeparator[0]);
			} else {
				data = opt;
				uid = uuid++;
				sendMap[uid] = ['S',uid,data].join(this.ieSeparator[0]);
			}
			message.send(postStr());
		};
		resultObj.get = function (data) {
			//  S<{IE}>0<{IE}>12345{<IE>}S<{IE}>1<{IE}>67890{<IE>}C<{IE}>0
			//=>S<{IE}>0<{IE}>12345
			//=>S<{IE}>1<{IE}>67890
			var datas = data.split(this.ieSeparator[1]), map = {};
			var params, opt, uid;
			for(var i = 0, len = datas.length; i < len; i++) {
				params = datas[i].split(this.ieSeparator[0]);
				opt = params.shift(); 
				uid = params.shift();
				data = params.join(this.ieSeparator[0]);
				if(opt == 'S') {
					map[uid] = 1;
					if (!cancelMap[uid]) { //未处理过，进行处理
						this.send('C', uid);
						this.child.get(data);
					}
				} else if(opt == 'C'){
					delete sendMap[uid];
				}
			}
			for (var i in cancelMap) {
				if(hasOwn.call(cancelMap, i) && !hasOwn.call(map, i)) {
					delete cancelMap[i];
				}
			}
		};
		return resultObj;
	}

	function prefixMessage (message, prefix) {
		
		var fun = function () {};
		fun.prototype = message;
		var resultObj = new fun();
		message.child = resultObj;
		
		resultObj.prefix = prefix|| '_crossD_';//可以理解为只读属性
		resultObj.send =  function (data) {
			message.send(this.prefix+data);
		};
		resultObj.get = function (str) {
			if (!!str && str.indexOf(this.prefix) == 0) {//解码成功，且前缀为prefix
				this.child.get(str.substr(this.prefix.length));
			}
		};
		return resultObj;
	}

	function callbackMessage (message, cbSeparator) {
		cbSeparator || (cbSeparator = '<{CB}>');
		var uuid = 0;
		var _callbackMap = {};
		var emptyFun = function () {};
		
		var fun = function () {};
		fun.prototype = message;
		var resultObj = new fun();
		message.child = resultObj;
		
		resultObj.cbSeparator = cbSeparator;//可以理解为只读属性
		resultObj.send = function (opt, uid, data) {
			//   '123456', fn
			// =>'S<{CB}>1<{CB}>1<{CB}>123456'
			//   '123456'
			// =>'S<{CB}>1<{CB}>0<{CB}>123456'
			//   'B',2,'abcde'
			// =>'B<{CB}>2<{CB}>abcde'
			var callback, needCallback = 0;
			if (opt == 'B' && !!data) {
				message.send(['B',uid,data].join(this.cbSeparator));
			} else {
				callback = uid;
				data = opt;
				uid = uuid++;
				if (!!callback) {
					needCallback = 1;
					_callbackMap[uid] = callback;
				}
				message.send(['S',uid,needCallback,data].join(this.cbSeparator));
			}
		};
		resultObj.get = function (str) {
			//  'S<{CB}>1<{CB}>1<{CB}>123456'
			//=>123456,function send('B',1, resultStr);
			//  'B<{CB}>2<{CB}>abcde'
			//=>
			var params = str.split(cbSeparator), callback;
			var needCallback, data;
			var opt = params.shift(), uid = params.shift();
			if(opt == 'S') {
				needCallback = params.shift();
				data = params.join(this.cbSeparator);
				if (needCallback == 1) {
					callback = function () {
						resultObj.send('B',uid, message.params2str.apply(message, arguments));
					}
				} else {
					callback = emptyFun;
				}
				this.child.get(data, callback);
			} else {
				data = params.join(this.cbSeparator);
				_callbackMap[uid].apply(null, message.str2params(data));
				delete _callbackMap[uid];
			}
		};
		return resultObj;
	}	

	function dealMessage (cbmessage, command) {
		
		var fun = function () {};
		fun.prototype = cbmessage;
		var resultObj = new fun();
		cbmessage.child = resultObj;
		
		resultObj.command = command;
		resultObj.send = function () {//fnName, params, callback
			//   'fnName', 'a', 'b', callback
			// =>'fnName<{DEL}>a<{DEL}>b',callback
			//   'fnName', 'a'
			// =>'fnName<{DEL}>a'
			var l = arguments.length, callback = arguments[l - 1];
			if( typeof callback == 'function') {
				cbmessage.send(cbmessage.params2str.apply(cbmessage, slice.call(arguments, 0, -1)),callback);
			} else {
				cbmessage.send(cbmessage.params2str.apply(cbmessage, slice.call(arguments, 0)));
			}
		};
		resultObj.setCommand = function (command) {
			resultObj.command = command;
		};
		resultObj.get = function (str, callback) {
			//  'S<{CB}>1<{CB}>1<{CB}>123456'
			//=>S<{IE}>0<{IE}>12345
			//=>S<{IE}>1<{IE}>67890
			var params =  cbmessage.str2params(str);
			params.push(callback)
			this.command.exec.apply(this.command, params);
		};
		return resultObj;
	}	


	//命令对象
	function Command () {
		this.command = {}; 
	}
	Command.prototype = {
		/**
		 * 执行命令函数
		 * @param {String} name 命令函数名
		 * @param {String} params{0,} 传递给 目标页面的命令方法 的参数，只支持string
		 * @param {Function} callback 成功的回调函数，默认为空函数
		 */
		exec : function() {
			var name = arguments[0], args = slice.call(arguments, 1);
			var fun = this.command[name];
			if (typeof fun != "undefined") {//其他消息
				if( typeof fun == 'function') {
					fun.apply(this.command, args);
				} else {
					//对应的是数值或字符串，直接执行回调
					var len = arguments.length;
					arguments[len-1](fun);
				}
			}
			return this;
		},
		/**
		 * this.command 添加属性，参数为一个时，则传入Object,将Object的自己的属性扩展到_command上
		 * @param {String|Object} name String时key值
		 * @param {Function} fun 函数方法
		 */
		add : function(name, fun) {
			if(arguments.length == 1) {
				for(var i in name) {
					if(hasOwn.call(name, i)) {
						this.add(i, name[i]);
					}
				}
			} else {
				this.command[name] = fun;
			}
			return this;
		}
	};
  
	/**
	 * 获取跨域对象
	 * @param {Object} config配置对象
	 * @return {Object} ifrme结点
	 */
	var jsURL = util.getCurrentScript();
	function getCrossDomain (config) {
		var messageObj;
		var commandMap = {
			'main': new Command(),//1
			'client': new Command()//2
		};
		
		var href = location.href;
		var clientUrl = config.clientUrl;
		var isSameDomain = util.isSameDomain(href, clientUrl);
		var isClient = href.indexOf(clientUrl) != -1, isProxy = href.indexOf('about:blank') != -1;
		
		var getMessaage = _sport == 'name'? function () {
			var obj = dealMessage(callbackMessage(prefixMessage(ieMessage(message()), config.prefix)));
			util.runReady(obj, 'send');
			return obj;
		}: function () {
			var obj = dealMessage(callbackMessage(prefixMessage(message(), config.prefix)));
			util.runReady(obj, 'send');
			return obj;
		};
		
		var commandList = [];
		commandList.exec = function () {
			var name = arguments[0];
			for (var i=0,len=this.length; i<len; i++) {
				if  (!!this[i][name]) {
					this[i].exec.apply(this[i], arguments);
					return;
				}
			}
		};
		
		var pageType = 0;
		if(isSameDomain) {//同域
			if(isClient == true) {//iframe页
				pageType = 2;
				messageObj = getMessaage();
				messageObj.send.setReady();
				messageObj.setProxy(win.parent);
				messageObj.setCommand(commandMap.client);//客户端
			} else {
				pageType = 3;
				messageObj = {
					send : function() {
						var command = this.command;
						this.command.exec.apply(this.command, arguments);
					}
				};
				commandList.push(commandMap.main,commandMap.client);//既是客户端，也是主端
				messageObj.setCommand(commandList);
			}
		} else {
			if(isProxy == true) {//IE6,7,name方式,情况存在 代理页
				messageObj = getMessaage();
				var frame = util.iframeLoad(clientUrl, function() {
					messageObj.setProxy(frame.contentWindow);
					messageObj.send.setReady();
				});
				messageObj.setCommand ({
					exec : function() {
						var command = win.mainMess.command;
						command.exec.apply(command, arguments);
					}
				})
				win.proxy = {
					send: function() {
						messageObj.send.apply(messageObj, arguments);
					},
					set: function () {
						messageObj.set.apply(messageObj, arguments);
					}
				};
			} else {//主端
				if(_sport == 'name') {
					var proxyWin;
					messageObj = {
						send : function() {
							proxyWin.proxy.send.apply(proxyWin, arguments);
						},
						set : function() {
							proxyWin.proxy.set.apply(proxyWin, arguments);
						},
						setCommand: function (command) {
							this.command = command;
						}
					};
					util.runReady(messageObj, 'send');
					var frame = util.iframeLoad('', function() {
						proxyWin = frame.contentWindow;
						proxyWin.mainMess = messageObj;
						proxyWin.config = config;
						util.scriptLoad(frame.contentWindow, jsURL, function() {
							messageObj.send.setReady();
						});
					});
				} else {
					messageObj = getMessaage();
					var frame = util.iframeLoad(clientUrl, function() {
						messageObj.setProxy(frame.contentWindow);
						messageObj.send.setReady();
					});
				}
				pageType = 1;
				messageObj.setCommand(commandMap.main);//主端
			}
		}
		
		return {
			message: messageObj, //通信对象
			commandMap: commandMap, //命令集对象
			isMain: function () { //判断当前页面主端
				return (pageType == 1 || pageType == 3);
			},
			isClient: function () { //判断当前页面客户端
				return (pageType == 2 || pageType == 3);
			}
		}
	};
	
	if (win.location.href.indexOf('about:blank') != -1&&win.mainMess&&!!win.config) {
		getCrossDomain(win.config);
	}
	
	win.getCrossDomain = getCrossDomain;
})(this, document);