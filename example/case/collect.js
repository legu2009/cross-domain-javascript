(function(win, doc, undefined) {
			
	var slice = Array.prototype.slice;
	var urlReg = /^[^:]+:\/*[^\/]+/;
	var messageSport = !!win.postMessage ? 'postMessage' : 'name';
	var hasOwn = Object.prototype.hasOwnProperty;
	var emptyFun = function () {};
	
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
	var uuid = 0;
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
				console.log(data);
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
		
		resultObj.set('prefix', prefix||'_crossD_');//多个使用默认存在问题，建议clientUrl MD5签名
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
		var _callbackMap = {};
		
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
				if (!!_callbackMap[uid]) {//多个情况，不一定是存在的
					_callbackMap[uid].apply(null, message.str2params(data));
					delete _callbackMap[uid];
				}
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
		resultObj.child = null;
		
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
			if (fun !== undefined) {//没有定义的命令，不处理
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
	var href = location.href;
	function getCrossDomain (config) {
		var messageObj;
		var mainCommand = new Command();//主端命令
		var clientCommand = new Command();//客户端命令
		
		var clientUrl = config.clientUrl;
		var aboutBlank = config.aboutBlank||'IE';//'IE','ALL'
		var isSameDomain = config.isSameDomain === undefined ? util.isSameDomain(href, clientUrl):!!config.isSameDomain;//当前页面和API提供地址是不是同域
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

		if(isClient == true) {//iframe页
			pageType = 2;
			messageObj = getMessaage();
			messageObj.send.setReady();
			messageObj.set({proxy:win.parent,command:clientCommand});
		} else if (isSameDomain) {//没有跨域，没有跨域，多参不需要转成字符串，所以默认就支持多种格式,【测试，没有具体情况】
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
		} else {
			//主端
			if (aboutBlank == 'IE' && messageSport == 'postMessage') {
				messageObj = getMessaage();
				var frame = util.iframeLoad(win, clientUrl, function() {
					messageObj.set('proxy', frame.contentWindow);
					messageObj.send.setReady();
				});
			} else if (aboutBlank != 'IE'|| (aboutBlank == 'IE' && messageSport == 'name')) {
				messageObj = getMessaage(false);
				var frame = util.iframeLoad(win, '', function() {
					messageObj.bindMessage(frame.contentWindow);
					var proxframe = util.iframeLoad(frame.contentWindow, clientUrl, function() {
						messageObj.set('proxy',proxframe.contentWindow);
						messageObj.send.setReady();
					});
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
	
	//业务逻辑
	var _util = (function () {

        //数字过滤
        var arrayFilter = function (arr, filter) {
            var result=[];
            for(var i=0,len=arr.length; i<len; i++) {
                var item = arr[i];
                if(filter(item)) {
					result.push(item);
				}
            }
            return result;
        };
        //返回一个元素下的所有子节点
        var children = doc.documentElement.children ? function(el) {
            return el.children;
			} : function (el) {
            return arrayFilter(el.children, function(el){return !!el.tagName;});
        };
		
        var makeArray=(function() {
            var slice = Array.prototype.slice,
			push  = Array.prototype.push;
			
            try {
                return function(arr, result) {
                    result = result || [];
                    if (arr.length) result = slice.call(arr, 0);
                    else result.push(arr);
                    return result;
                };
			} catch (ex) {
                return function(arr, result) {
                    result = result || [];
                    if (Object.prototype.toString.call(arr)=='[object Array]' || !arr.length) {
                        push.call(result, arr);
                    } else if (arr.length) {
                        for (var i=0, len=arr.length; i<len; i++) {
                            result.push(arr[i]);
                        }
                    } else {
                        throw new Error(['makeArray','unexpect arguments "' +arr+ '"']);
                    }
                    return result;
                }
            };
        })();
		
		return {
			getJsNode: function () {
				var scripts = doc.getElementsByTagName("script");
				var len = scripts.length;
				while (len--) {
					var script = scripts[len];
					if (script.src && script.src.indexOf('statistics_v2.js')!=-1) {
						return script;
					}
				}
				return null;
			},
			setCookie: function (sName, sValue, oExpires, sPath, sDomain, bSecure) {
				var sCookie = sName + "=" + encodeURIComponent(sValue);
				if (oExpires) {
					if (typeof(oExpires) == "string") {
						var de = new Date();
						de.setTime(new Date().getTime() + parseInt(oExpires));
						oExpires = de.toGMTString();
					} else {
						oExpires = oExpires.toGMTString();
					}
					sCookie += "; expires=" + oExpires;
				}
				if (sPath) {
					sCookie += "; path=" + sPath;
				}
				if (sDomain) {
					sCookie += "; domain=" + sDomain;
				}
				if (bSecure) {
					sCookie += "; secure";
				}
				doc.cookie = sCookie;
			},
			removeCookie: function (sName, sPath, sDomain, bSecure) {
				this.setCookie(sName, "", new Date(0), sPath, sDomain, bSecure);
			},
			getCookie:  function (sName) {
				var sRE = "(?:; )?" + sName + "=([^;]*);?";
				var oRE = new RegExp(sRE);
				if (oRE.test(doc.cookie)) {
					return decodeURIComponent(RegExp["$1"]);
				} else {
					return null;
				}
			},
			send:function (a, f) {
				var d = new Image(1, 1);
				d.onerror = d.onload = function () {
					d = null;
					try {
						f && f();
						} catch (e) {
					}
				};
				d.src = a;
			},
			bindDownloadDoms: function (fn) {
				var _doms=[];
				if (d.querySelectorAll) {
					_doms=d.querySelectorAll("[wn_tj_down]");
				} else {
					(function(dom){
						var childs=makeArray(children(dom));
						for(var i=0;i<childs.length;i++){
							if(childs[i].getAttribute("wn_tj_down")){
								_doms.push(childs[i]);
							}
							children(childs[i]).length&&arguments.callee(childs[i]);
						}
					})(d.body);
				}
				for(var i=0;i<_doms.length;i++){
					var ele = _doms[i];
					if (ele.tagName.toUpperCase() == 'A') {
						ele.setAttribute('wntj_href', ele.href);
						ele.setAttribute('target', '_self');
						ele.href = 'javascript:;';
					}
					
					util.addEvent(ele,"click",function (ele) {
						return function () {
							fn.call(ele);
						}
					}(ele));
				}
			},
			replace_: function (val) {
				var ary = val.split('|');
				for (var i = 0,len = ary.length; i< len; i++) {
					if (ary[i] == '-')  ary[i] = '';
				}
				return ary.join('|');
			}
		};
	})();
	
	var flash = (function () {
		var _status = '';
		var _flashObj;
		var _timeId = 0;
		var flashversion = function () {
			var D = navigator.plugins;
			if (D && D.length) {
				for (var C = D.length; C--;) {
					if (/Shockwave Flash/.test(D[C].name)) {
						return D[C].description.substr(16);
					}
				}
			} else {
				if (win.ActiveXObject) {
					try {
						return new ActiveXObject("ShockwaveFlash.ShockwaveFlash").GetVariable("$version").replace(/^WIN /i, "")
						} catch (E) {
					}
				}
			}
			return 0
		}();
		
		function _createFlash (E) {
			function __createFlash () {
				var body = doc.body;
				if (!!body) {
					var html;
					var flashCot = doc.createElement("div");
					body.insertBefore(flashCot, body.firstChild);
					flashCot.style.cssText = "position:absolute;display:block;left:-500px;width:1px;height:1px;";
					E.id = E.id || "sdo_beacon_flash";
					if ("classid" in doc.createElement("object")) {
						html = '<object classid="clsid:d27cdb6e-ae6d-11cf-96b8-444553540000" name="' + E.id + '" id="' + E.id + '" width="' + E.width + '" height="' + E.height + '"><param name="allowScriptAccess" value="always" /><param name="quality" value="high" /><param name="wmode" value="window" /><param name="movie" value="' + E.src + '" /></object>"';
					} else {
						html = '<embed style="width:1px;height:1px;" wmode="window" src="' + E.src + '" quality="high" name="' + E.id + '" id="' + E.id + '" width="' + E.width + '" height="' + E.height + '"allowScriptAccess="always" type="application/x-shockwave-flash"/>';
					}
					flashCot.innerHTML = html;
					_flashObj = flashCot.firstChild;
					_status = "create";
				} else {
					setTimeout(__createFlash, 100);
				}
			}
			__createFlash();
		}
		
		function _ckeckFlashReady () {
			if (!!_flashObj && !!_flashObj.saveAttribute && !!_flashObj.loadAttribute) {
				_status = 'load';
				flash.onload.setReady();
				flash.save.setReady();
				flash.load.setReady();
			} else {
				setTimeout(_ckeckFlashReady, 1000);
			}
		}
		
		return {
			getStatus: function () {
				return _status;
			},
			create: function (flashUrl) {
				if (!(location.protocol == "http:" && flashversion)) {
					_status = 'nosupport';
					flash.onload.setReady();
					flash.save.setReady();
					flash.load.setReady();
					return false;
				}
				_createFlash({src: flashUrl});
				_ckeckFlashReady();
			},
			save: function () {
				try {
					_flashObj.saveAttribute.apply(_flashObj,arguments);
				} catch (e) {}
				return this;
			},
			load: function (str, gameId, callback) {
				var res;
				try {
					res = _flashObj.loadAttribute(str, gameId)||'';
				} catch (e) {
					res = '';
				}
				callback(res);
			},
			onload: function (callback) {
				callback();
			}
		}

	})();
	util.runReady(flash, 'onload');
	util.runReady(flash, 'save');
	util.runReady(flash, 'load');
	
	
	(function () {
		var srcript = _util.getJsNode();
		var options;
		var _domain = /([^\.]+)\.(?:com|cn|net|org)$/.test(document.domain) ? RegExp.$1 : "",
			domain = /(playsnail|woniu)/.test(srcript.src)? RegExp.$1 : '',
			protocol = "https:" == win["location"].protocol ? "https://" : "http://",
			clientUrl =  protocol + "gg." + domain + ".com/src/statistics/crossDomain_v2.html",
			downloadUrl = protocol + "dd." + domain + ".com/_down.gif",
			leadUrl = protocol + "dd." + domain + ".com/_lead.gif",
			regUrl = protocol + "dd." + domain + ".com/_prereg.gif",
			flashUrl = protocol +"gg." + domain + ".com/src/api/flash/share.swf",
			
			w_wd = _util.getCookie("WNAD_wd") || "-", //兼容老版本，默认是为'-'
			w_sd = _util.getCookie("WNAD_sd") || "-",
			w_ud = _util.getCookie("WNAD_ud") || "-",
			w_td = _util.getCookie("WNAD_td") || "-",
			w_time = _util.getCookie("WNAD_time");
			
		var config = {
			clientUrl: clientUrl,
			isSameDomain: _domain == domain
		};
		
		function _collectLead() {
			_util.send(leadUrl);
		}
		
		function _collectReg() {
			w_time && _util.removeCookie("WNAD_time");
			var _url = regUrl + (w_time ? ("?lt=" + (new Date().getTime() - w_time * 1)) : "");
			_util.send(_url);
		}
		
		function collect (callback) {
			if(options.kind==1||options.kind==2) {
				_collectLead();
			}
			if(options.kind==1||options.kind==3) {
				_collectReg();
			}
			!!callback && callback();
		}
		
		
		var crossDomain = getCrossDomain(config);
		if (crossDomain.isMain()) {
			crossDomain.mainCommand.add('collect', collect);
		};
		if (crossDomain.isClient()) {
			flash.onload(function () {
				var w_wd = _util.getCookie("WNAD_wd") || "-",
				w_sd = _util.getCookie("WNAD_sd") || "-",
				w_ud = _util.getCookie("WNAD_ud") || "-",
				w_td = _util.getCookie("WNAD_td") || "-";
				if (w_wd != '-') {
					flash.save("woniu_tj", 0, [w_wd, w_ud, w_sd, w_td].join("|"));
				}
			});
			crossDomain.clientCommand.add('setOptions', function(gameId, kind, client, callback) {
				options = {
					gameId: gameId,
					kind: kind,
					client: client
				};
				flash.create(flashUrl+(options.client !=='0'?'?'+new Date().valueOf():''));
				callback();
			});
			crossDomain.clientCommand.add('save_ek_ev', function(callback) {
				var w_wd = _util.getCookie("WNAD_wd") || "-",
				w_sd = _util.getCookie("WNAD_sd") || "-",
				w_ud = _util.getCookie("WNAD_ud") || "-",
				w_td = _util.getCookie("WNAD_td") || "-";
				if (w_wd != '-') {//存在广告cookie
					flash.save("woniu_tj", options.gameId, [w_wd, w_ud, w_sd, w_td].join("|"));
				}
				callback();
			});
			crossDomain.clientCommand.add('get_ek_ev', function(gameId, callback) { //获取最新cookie,优先cookie||flash(ganmeId=0)
				var w_wd = _util.getCookie("WNAD_wd") || "-",
				w_sd = _util.getCookie("WNAD_sd") || "-",
				w_ud = _util.getCookie("WNAD_ud") || "-",
				w_td = _util.getCookie("WNAD_td") || "-";
				
				if (gameId == 0 && w_wd != '-') {
					callback(_util.replace_([w_wd, w_ud, w_sd, w_td].join("|")));
				} else {
					flash.load("woniu_tj", gameId, callback);
				}
			});
		};
		
		if (crossDomain.isMain()) {
			 options = {
				gameId: srcript.getAttribute("gameId") || "0",
				kind: srcript.getAttribute("kind") || (srcript.getAttribute("isReg") == "true"? "1": "2"),
				client: srcript.getAttribute("client") || '0'
			};
			crossDomain.message.send('setOptions',options.gameId, options.kind, options.client);
			
			(function () {//统计下载支持
				//事件兼容问题
				function downLoadSend(){
					//this指向,ie装下载器,下载不能统计，考虑先走代理接口
					//##2 需要通知代理页根据游戏ID存最新的cookie
					crossDomain.message.send('save_ek_ev');
					var _href = this.getAttribute('wntj_href');
					_util.send(downloadUrl, function () {
						window.location.href = _href;
					});
				}
				
				if(win.jQuery){
					try{
						jQuery("[wn_tj_down]").click(downLoadSend).each(function () {
							if (this.tagName.toUpperCase() == 'A') {
								this.setAttribute('wntj_href', this.href);
								this.setAttribute('target', '_self');
								this.href = 'javascript:;';
							}
						});
					}catch(e){}
				}else{
					_util.bindDownloadDoms(downLoadSend);
				}
			})();

			win.wntj = {
				collect: collect,
				get_ek_ev: function (gameId, callback) {//兼容老版本
					console.log('get_ek_ev');
					crossDomain.message.send('get_ek_ev',0,function (str) {
						if (str != '') {
							callback({
								ek: 10,
								ev: str
							});
						}
					});
				},
				get_ek_ev0: function (gameId, callback) {
					console.log('get_ek_ev0');
					crossDomain.message.send('get_ek_ev',gameId,function (str) {
						callback({
							ek: 10,
							ev: str
						});
					});
				},
				get_ek_ev2: function (gameId, callback) {//兼容get_ek_ev函数
					console.log('get_ek_ev2');
					crossDomain.message.send('get_ek_ev',0,function (str) {	
						callback({
							ek: 10,
							ev: str
						});
					});
				}
			};
		}
		
		if (crossDomain.isClient()) {
			if (w_wd != '-') { //存在cookie,通知广告页采集
				crossDomain.message.send('collect');
			}			
		}
		
	})();
	
	//win.getCrossDomain = getCrossDomain;
})(this, document);