(function(win, doc, undefined) {
			
	var slice = Array.prototype.slice;
	var urlReg = /^[^:]+:\/*[^\/]+/;
	var messageSport = !!win.postMessage ? 'postMessage' : 'name';
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
		//来自司徒正妹的mass框架
		//https://github.com/RubyLouvre/mass-Framework/blob/master/mass.js line 407
		getCurrentScript: function () {
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
		  * win动态添加ifrme结点，设置url，载入后回调
		  * @param {window} win window对象
		  * @param {String} url ifrme地址
		  * @param {Function} callback？ifrme加载完成，回调方法
		  * @return {Node} ifrme结点
		  */
		iframeLoad : function(win, url, callback) {
			var doc = win.document;
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
		  *     在调用setReady时，批量执行list存储的参数
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
	//底层通信对象
	function message() {
		var hash = '';
		var message = {
			sport : messageSport,
			send : messageSport == 'name'? function(data) {//send(编码)
				this.proxy.name = data;
			}:  function(data) {
				this.proxy.postMessage(data, '*');
			},
			get : function(data) {//get(解码),绑定该get
				this.child.get(data);
			},
			//监听指定window的message事件，或name的改变
			bindMessage: function (win) {
				if (messageSport == 'postMessage') {
					util.addEvent(win,'message', function (e) {
						message.get(e.data);
					})
				} else {
					hash = win.name;//忽略页面当前的name值
					setInterval(function() {
						if(win.name != hash) {
							hash = win.name;
							message.get(hash);
						}
					}, 50);
				}
			},
			//设置方法或属性，通过原型继承读取
			set: function (name, value) {
				if( typeof name == 'string') {
					message[name] = value;
				} else {
					for (var i in name) {
						if(hasOwn.call(name, i)) {
							message[i] = name[i];
						}
					}
				}
			}
		};
		//默认多参数支持方式，需要JSON支持，需要自行设置，见example
		message.set({
			params2str: function () {
				return slice.call(arguments).join('<{PA}>');
			},
			str2params: function (str) {
				return str.split('<{PA}>');
			}
		});
		return message;
	};
	
	//修正IE,使IE支持多消息的支持
	function ieMessage (message, ieSeparator) {
		ieSeparator || (ieSeparator = ['<{IE}>', '{<IE>}']);
		var uuid = 0;
		var sendMap = {};//主动发出的消息
		var cancelMap = {};//正在处理中的数据，通知不需要再传送
		
		function push(ary, obj) {//obj的值，添加到ary数组中
			for(var i in obj) {
				if(hasOwn.call(obj, i)) {
					ary.push(obj[i]);
				}
			}
			return ary;
		}
		
		function postStr(separator) {
			var ary = [];
			push(ary, sendMap);
			push(ary, cancelMap);
			return ary.join(separator);
		}
		
		var fun = function () {};
		fun.prototype = message;
		var resultObj = new fun();
		message.child = resultObj;
		
		resultObj.set('ieSeparator', ieSeparator);
		resultObj.send = function (opt, uid) {
			//  12345
			//=>S<{IE}>0<{IE}>12345
			//  67890
			//=>S<{IE}>0<{IE}>12345{<IE>}S<{IE}>1<{IE}>67890
			//  C,0
			//=>S<{IE}>0<{IE}>12345{<IE>}S<{IE}>1<{IE}>67890{<IE>}C<{IE}>0
			var data;
			var ieSeparator = this.ieSeparator;
			if (opt == 'C' && !!uid){//发送“取消发送”的消息
				cancelMap[uid] = [opt,uid].join(ieSeparator[0]);
			} else {
				data = opt;
				uid = uuid++;
				sendMap[uid] = ['S',uid,data].join(ieSeparator[0]);
			}
			message.send(postStr(ieSeparator[1]));
		};
		resultObj.get = function (data) {
			//  S<{IE}>0<{IE}>12345{<IE>}S<{IE}>1<{IE}>67890{<IE>}C<{IE}>0
			//=>S<{IE}>0<{IE}>12345
			//=>S<{IE}>1<{IE}>67890
			var ieSeparator = this.ieSeparator;
			var datas = data.split(ieSeparator[1]), map = {};
			var params, opt, uid;
			for(var i = 0, len = datas.length; i < len; i++) {
				params = datas[i].split(ieSeparator[0]);
				opt = params.shift(); 
				uid = params.shift();
				data = params.join(ieSeparator[0]);
				if(opt == 'S') {
					map[uid] = 1;
					if (!cancelMap[uid]) { //未处理过，进行处理
						this.send('C', uid);
						this.child.get(data);
					}
				} else if(opt == 'C'){
					delete sendMap[uid];//消息来源端 接收到C命令，则下次不在传送
				}
			}
			for (var i in cancelMap) {
				if(hasOwn.call(cancelMap, i) && !hasOwn.call(map, i)) {
					delete cancelMap[i];//没有传过来，表示C命令消息来源端已执行
				}
			}
		};
		return resultObj;
	}

	//消息前缀
	function prefixMessage (message, prefix) {
		var fun = function () {};
		fun.prototype = message;
		var resultObj = new fun();
		message.child = resultObj;
		
		resultObj.set('prefix', prefix||'_crossD_');
		resultObj.send =  function (data) {
			message.send(this.prefix+data);
		};
		resultObj.get = function (str) {
			if (!!str && str.indexOf(this.prefix) == 0) {//解码成功，且前缀为prefix，对消息进行了过滤
				this.child.get(str.substr(this.prefix.length));
			}
		};
		return resultObj;
	}

	//回调机制的支持，callback进行缓存，对应消息返回时，对消息内容执行对应的callback
	function callbackMessage (message, cbSeparator) {
		cbSeparator || (cbSeparator = '<{CB}>');
		var uuid = 0;
		var _callbackMap = {};
		var emptyFun = function () {};
		
		var fun = function () {};
		fun.prototype = message;
		var resultObj = new fun();
		message.child = resultObj;
		
		resultObj.set('cbSeparator', cbSeparator);
		resultObj.send = function (opt, uid, data) {
			//   '123456', fn
			// =>'S<{CB}>1<{CB}>1<{CB}>123456'
			//   '123456'
			// =>'S<{CB}>1<{CB}>0<{CB}>123456'
			//   'B',2,'abcde'
			// =>'B<{CB}>2<{CB}>abcde'
			var callback, needCallback = 0;
			var cbSeparator = this.cbSeparator;
			if (opt == 'B' && !!data) {
				message.send(['B',uid,data].join(cbSeparator));
			} else {
				callback = uid;
				data = opt;
				uid = uuid++;
				if (!!callback) {
					needCallback = 1;
					_callbackMap[uid] = callback;//缓存回调方法
				}
				message.send(['S',uid,needCallback,data].join(cbSeparator));
			}
		};
		resultObj.get = function (str) {
			//  'S<{CB}>1<{CB}>1<{CB}>123456'
			//=>123456,function send('B',1, resultStr);
			//  'B<{CB}>2<{CB}>abcde'
			//=>回调(abcde)
			var cbSeparator = this.cbSeparator;
			var params = str.split(cbSeparator), callback;
			var needCallback, data;
			var opt = params.shift(), uid = params.shift();
			if(opt == 'S') {
				needCallback = params.shift();
				data = params.join(cbSeparator);
				if (needCallback == 1) {
					callback = function () {
						resultObj.send('B',uid, message.params2str.apply(message, arguments));
					}
				} else {
					callback = emptyFun;
				}
				this.child.get(data, callback);
			} else {
				//回调执行 结果
				data = params.join(cbSeparator);
				_callbackMap[uid].apply(null, message.str2params(data));
				delete _callbackMap[uid];
			}
		};
		return resultObj;
	}	
	
	//处理命令，相关消息处理，统一通过command.exec方法进行执行
	function dealMessage (cbmessage, command) {
		
		var fun = function () {};
		fun.prototype = cbmessage;
		var resultObj = new fun();
		cbmessage.child = resultObj;
		
		resultObj.set('command', command);
		resultObj.send = function () {//fnName, params, callback
			//   'fnName', 'a', 'b', callback
			// =>'fnName<{DEL}>a<{DEL}>b',callback
			//   'fnName', 'a'
			// =>'fnName<{DEL}>a'
			var l = arguments.length, callback = arguments[l - 1];
			if( typeof callback == 'function') {
				cbmessage.send(cbmessage.params2str.apply(cbmessage, slice.call(arguments, 0, -1)),callback);
			} else {
				cbmessage.send(cbmessage.params2str.apply(cbmessage, slice.call(arguments)));
			}
		};
		resultObj.get = function (str, callback) {
			//  '123456<{PA}>abcd',callback
			//=>command.exec('123456','abcd',callback)
			//=>S<{IE}>1<{IE}>67890
			var params =  cbmessage.str2params(str);
			var command = this.command;
			params.push(callback)
			command.exec.apply(command, params);
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
			if (typeof fun != "undefined") {//没有定义的命令，不处理
				if( typeof fun == 'function') {
					fun.apply(this.command, args);
				} else {
					//对应的属性是数值或字符串，直接执行回调
					var len = arguments.length;
					arguments[len-1](fun);
				}
			}
		},
		/**
		 * this.command 添加属性，参数为一个时，则传入Object,将Object的自己的属性扩展到command上
		 * @param {String|Object} name String时key值
		 * @param {Function} fun 函数方法
		 */
		add : function(name, fun) {
			if(arguments.length == 1) {
				for(var i in name) {
					if(hasOwn.call(name, i)) {
						this.command[i] = name[i];
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
	var href = location.href;
	function getCrossDomain (config) {
		var messageObj;
		var mainCommand = new Command();//主端命令
		var clientCommand = new Command();//客户端命令
		
		var clientUrl = config.clientUrl;
		var isSameDomain = config.isSameDomain || util.isSameDomain(href, clientUrl);//当前页面和API提供地址是不是同域
		//获取消息对象
		var getMessaage = messageSport == 'name'? function (isBindMessage) {
			var obj = dealMessage(callbackMessage(ieMessage(prefixMessage(message(), config.prefix))));
			util.runReady(obj, 'send');
			if (isBindMessage !== false) {
				obj.bindMessage(win);
			}
			return obj;
		}: function (isBindMessage) {
			var obj = dealMessage(callbackMessage(prefixMessage(message(), config.prefix)));
			util.runReady(obj, 'send');
			if (isBindMessage !== false) {
				obj.bindMessage(win);
			}
			return obj;
		};
		var isClient = href.indexOf(clientUrl) != -1;
		
		//消息队列，不跨域情况的支持
		var commandList = [];
		commandList.exec = function () {
			var name = arguments[0];
			for (var i=0,len=this.length; i<len; i++) {
				if  (!!this[i].command[name]) {
					this[i].exec.apply(this[i], arguments);
					return;
				}
			}
		};
		
		var pageType = 0;
		var emptyFun = function () {};
		if(isSameDomain) {//同域
			if(isClient == true) {//iframe页
				pageType = 2;
				messageObj = getMessaage();
				messageObj.send.setReady();
				messageObj.set({proxy:win.parent,command:clientCommand});
			} else {//没有跨域，没有跨域，多参不需要转成字符串，所以默认就支持多种格式
				pageType = 3;
				commandList.push(clientCommand,mainCommand);
				messageObj = {
					send : function() {
						var command = this.command, arg;
						var callback = arguments[arguments.length-1];
						if (typeof callback == 'function') {
							command.exec.apply(command, arguments);
						} else {
							arg = slice.call(arguments);
							arg.push(emptyFun);
							command.exec.apply(command, arg);
						}
						
					},
					command: commandList//既是客户端，也是主端
				};
			}
		} else {
			//主端
			if(messageSport == 'name') {//IE的情况，使用about:blank代理
				messageObj = getMessaage(false);
				var frame = util.iframeLoad(win, '', function() {
					messageObj.bindMessage(frame.contentWindow);
					var proxframe = util.iframeLoad(frame.contentWindow, clientUrl, function() {
						messageObj.set('proxy',proxframe.contentWindow);
						messageObj.send.setReady();
					});
				});
			} else {
				messageObj = getMessaage();
				var frame = util.iframeLoad(win, clientUrl, function() {
					messageObj.set('proxy', frame.contentWindow);
					messageObj.send.setReady();
				});
			}
			messageObj.set('command', mainCommand);
			pageType = 1;
		}
		
		return {
			message: messageObj, //通信对象
			mainCommand: mainCommand, 
			clientCommand: clientCommand,
			isMain: function () { //判断当前页面主端
				return (pageType == 1 || pageType == 3);
			},
			isClient: function () { //判断当前页面客户端
				return (pageType == 2 || pageType == 3);
			}
		}
	};
		
	win.getCrossDomain = getCrossDomain;
})(this, document);