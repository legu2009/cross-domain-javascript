(function(win, doc, undefined) {
			
	var slice = Array.prototype.slice;
	var urlReg = /^[^:]+:\/*[^\/]+/;
	var messageSport = !!win.postMessage ? 'postMessage' : 'name';
	var hasOwn = Object.prototype.hasOwnProperty;
	
	//============================��������===========================
	var util = {
		addEvent: doc.attachEvent ? function(element, event, fn) {
			element.attachEvent('on' + event, fn);
		} : function(element, event, fn) {
			element.addEventListener(event, fn, false);
		},	
		isSameDomain: function (urlA, urlB) {//��д�ģ���������
			var strA = urlA.match(urlReg)[0].replace(/:80$/,'').replace(/:\/+/,''),strB = urlB.match(urlReg)[0].replace(/:80$/,'').replace(/:\/+/,'');
			return  strA == strB;
		},
		//����˾ͽ���õ�mass���
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
		  * ��̬���ifrme��㣬����url�������ص�
		  * @param {String} url ifrme��ַ
		  * @param {Function} callback��ifrme������ɣ��ص�����
		  * @return {Node} ifrme���
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
		  * ����obj��name������д������setReady����
		  *     �ڵ���setReady֮ǰ�����ú������洢������list��
		  *     �ڵ���setReadyʱ������ִ��list�洢�Ĳ���(���ӳ�ִ��)
		  *     �ڵ���setReady֮�󣬵��ú���������ִ�У�
		  * @param {Object} obj ����
		  * @param {String} name �����Ķ�Ӧ��������
		  * @return {Node} ifrme���
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
	
	//============================ͨ�Ŷ���===========================
	//�ײ�ͨ�Ŷ���
	function message() {
		var hash = '';
		var message = {
			sport : messageSport,
			send : messageSport == 'name'? function(data) {//send(����)
				this.proxy.name = data;
			}:  function(data) {
				this.proxy.postMessage(data, '*');
			},
			get : function(data) {//get(����),�󶨸�get
				this.child.get(data);
			},
			bindMessage: function (win) {
				if (messageSport == 'postMessage') {
					util.addEvent(win,'message', function (e) {
						message.get(e.data);
					})
				} else {
					hash = win.name;
					setInterval(function() {
						if(win.name != hash) {
							hash = win.name;
							message.get(hash);
						}
					}, 50);
				}
			},
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
		
	function ieMessage (message, ieSeparator) {
		ieSeparator || (ieSeparator = ['<{IE}>', '{<IE>}']);
		var uuid = 0;
		var sendMap = {};//������������Ϣ
		var cancelMap = {};//���ڴ����е����ݣ�֪ͨ����Ҫ�ٴ���
		
		function push(ary, obj) {//obj��ֵ����ӵ�ary������
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
			if (opt == 'C' && !!uid){//���͡�ȡ�����͡�����Ϣ
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
					if (!cancelMap[uid]) { //δ����������д���
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
		
		resultObj.set('prefix', prefix||'_crossD_');
		resultObj.send =  function (data) {
			message.send(this.prefix+data);
		};
		resultObj.get = function (str) {
			if (!!str && str.indexOf(this.prefix) == 0) {//����ɹ�����ǰ׺Ϊprefix
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
					_callbackMap[uid] = callback;
				}
				message.send(['S',uid,needCallback,data].join(cbSeparator));
			}
		};
		resultObj.get = function (str) {
			//  'S<{CB}>1<{CB}>1<{CB}>123456'
			//=>123456,function send('B',1, resultStr);
			//  'B<{CB}>2<{CB}>abcde'
			//=>
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
				data = params.join(cbSeparator);
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
			//  'S<{CB}>1<{CB}>1<{CB}>123456'
			//=>S<{IE}>0<{IE}>12345
			//=>S<{IE}>1<{IE}>67890
			var params =  cbmessage.str2params(str);
			var command = this.command;
			params.push(callback)
			command.exec.apply(command, params);
		};
		return resultObj;
	}	


	//�������
	function Command () {
		this.command = {}; 
	}
	Command.prototype = {
		/**
		 * ִ�������
		 * @param {String} name �������
		 * @param {String} params{0,} ���ݸ� Ŀ��ҳ�������� �Ĳ�����ֻ֧��string
		 * @param {Function} callback �ɹ��Ļص�������Ĭ��Ϊ�պ���
		 */
		exec : function() {
			var name = arguments[0], args = slice.call(arguments, 1);
			var fun = this.command[name];
			if (typeof fun != "undefined") {//������Ϣ
				if( typeof fun == 'function') {
					fun.apply(this.command, args);
				} else {
					//��Ӧ������ֵ���ַ�����ֱ��ִ�лص�
					var len = arguments.length;
					arguments[len-1](fun);
				}
			}
		},
		/**
		 * this.command ������ԣ�����Ϊһ��ʱ������Object,��Object���Լ���������չ��_command��
		 * @param {String|Object} name Stringʱkeyֵ
		 * @param {Function} fun ��������
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
	 * ��ȡ�������
	 * @param {Object} config���ö���
	 * @return {Object} ifrme���
	 */
	var jsURL = util.getCurrentScript();
	var href = location.href;
	function getCrossDomain (config) {
		var messageObj;
		var mainCommand = new Command();
		var clientCommand = new Command();
		
		var clientUrl = config.clientUrl;
		var isSameDomain = config.isSameDomain || util.isSameDomain(href, clientUrl);
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
		var isClient = href.indexOf(clientUrl) != -1, isProxy = href.indexOf('about:blank') != -1;
		
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
		if(isSameDomain) {//ͬ��
			if(isClient == true) {//iframeҳ
				pageType = 2;
				messageObj = getMessaage();
				messageObj.send.setReady();
				messageObj.set({proxy:win.parent,command:clientCommand});
			} else {
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
					command: commandList//���ǿͻ��ˣ�Ҳ������
				};
			}
		} else {
			//����
			if(messageSport == 'name') {
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
			message: messageObj, //ͨ�Ŷ���
			mainCommand: mainCommand, 
			clientCommand: clientCommand,
			isMain: function () { //�жϵ�ǰҳ������
				return (pageType == 1 || pageType == 3);
			},
			isClient: function () { //�жϵ�ǰҳ��ͻ���
				return (pageType == 2 || pageType == 3);
			}
		}
	};
		
	win.getCrossDomain = getCrossDomain;
})(this, document);