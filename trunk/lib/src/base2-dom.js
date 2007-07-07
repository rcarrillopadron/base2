// timestamp: Tue, 03 Jul 2007 20:32:36

new function(_) { ////////////////////  BEGIN: CLOSURE  ////////////////////

// =========================================================================
// DOM/namespace.js
// =========================================================================

var DOM = new base2.Namespace(this, {
	name:    "DOM",
	version: "0.9 (alpha)",
	imports: "BOM",
	exports: "Node,Document,Element,Traversal,AbstractView,Event,EventTarget,DocumentEvent,Selector,DocumentSelector,ElementSelector,StaticNodeList,ViewCSS,HTMLDocument,HTMLElement"
});

eval(this.imports);

// =========================================================================
// DOM/Interface.js
// =========================================================================

// The DOM.Interface module is the base module for defining DOM interfaces.
// Interfaces are defined with reference to the original W3C IDL.
// e.g. http://www.w3.org/TR/DOM-Level-3-Core/core.html#ID-1950641247

var Interface = Module.extend(null, {
	createDelegate: function(name) {
		// delegate a static method to the bound object
		//  e.g. for most browsers:
		//    EventTarget.addEventListener(element, type, func, capture) 
		//  forwards to:
		//    element.addEventListener(type, func, capture)
		this[name] = function(object) {
			var m = (object.base && object.base == object[name].ancestor) ? "base" : name;
			return object[m].apply(object, slice(arguments, 1));
		};
	},
	
	extend: function(_interface, _static) {
		// extend a module to create a new module
		var module = this.base();
		// implement delegates
		forEach (_interface, function(source, name) {
			if (typeof source == "function" && !module[name]) {
				module.createDelegate(name);
			} else if (name.charAt(0) == "@") {
				forEach (source, arguments.callee);
			}
		});
		// implement module (instance AND static) methods
		module.implement(_interface);
		// implement static properties and methods
		extend(module, _static);
		// Make the submarine noises Larry!
		if (typeof module.init == "function") module.init();
		return module;
	},
	
	"@!(element.addEventListener.apply)": {
		createDelegate: function(name) {
			// can't invoke Function.apply on COM object methods. Shame.
			//  (this is also required for Safari)
			this[name] = function(object) {
				var m = (object.base && object.base == object[name].ancestor) ? "base" : name;
				// unroll for speed
				switch (arguments.length) {
					case 1: return object[m]();
					case 2: return object[m](arguments[1]);
					case 3: return object[m](arguments[1], arguments[2]);
					case 4: return object[m](arguments[1], arguments[2], arguments[3]);
				}
				// use eval() if there are lots of arguments
				var args = [], i = arguments.length;
				while (i-- > 1) args[i - 1] = "arguments[" + i + "]";
				eval("var returnValue=object[m](" + args + ")");
				return returnValue;
			};
		}
	}
});

// =========================================================================
// DOM/Binding.js
// =========================================================================

var Binding = Interface.extend(null, {
	bind: function(object) {
		return this(object); // cast
	}
});

// =========================================================================
// DOM/Traversal.js
// =========================================================================

// DOM Traversal. Just the basics.

var Traversal = Module.extend({
	getDefaultView: function(node) {
		return this.getDocument(node).defaultView;
	},
	
	getNextElementSibling: function(node) {
		// return the next element to the supplied element
		//  nextSibling is not good enough as it might return a text or comment node
		while (node && (node = node.nextSibling) && !this.isElement(node)) continue;
		return node;
	},

	getNodeIndex: function(node) {
		var index = 0;
		while (node && (node = node.previousSibling)) index++;
		return index;
	},
	
	getOwnerDocument: function(node) {
		// return the node's containing document
		return node.ownerDocument;
	},
	
	getPreviousElementSibling: function(node) {
		// return the previous element to the supplied element
		while (node && (node = node.previousSibling) && !this.isElement(node)) continue;
		return node;
	},

	getTextContent: function(node) {
		return node[Traversal.$TEXT];
	},

	isEmpty: function(node) {
		node = node.firstChild;
		while (node) {
			if (node.nodeType == 3 || this.isElement(node)) return false;
			node = node.nextSibling;
		}
		return true;
	},

	setTextContent: function(node, text) {
		return node[Traversal.$TEXT] = text;
	},
	
	"@MSIE": {
		getDefaultView: function(node) {
			return this.getDocument(node).parentWindow;
		},
	
		"@MSIE5": {
			// return the node's containing document
			getOwnerDocument: function(node) {
				return node.ownerDocument || node.document;
			}
		}
	}
}, {
	$TEXT: "textContent",
	
	contains: function(node, target) {
		return this.isDocument(node) ? node == this.getOwnerDocument(target) : node != target && node.contains(target);
	},
	
	getDocument: function(node) {
		// return the document object
		return this.isDocument(node) ? node : this.getOwnerDocument(node);
	},
	
	isDocument: function(node) {
		return Boolean(node && node.documentElement);
	},
	
	isElement: function(node) {
		return Boolean(node && node.attributes);
	},
	
	"@!(element.contains)": {
		contains: function(node, target) {
			while (target && (target = target.parentNode) && node != target) continue;
			return !!target;
		}
	},
	
	"@MSIE": {
		$TEXT: "innerText"
	},
	
	"@MSIE5": {
		isElement: function(node) {
			return this.base(node) && node.tagName != "!";
		}
	}
});

// =========================================================================
// core/Node.js
// =========================================================================

// http://www.w3.org/TR/DOM-Level-3-Core/core.html#ID-1950641247

var Node = Binding.extend({	
	"@!(element.compareDocumentPosition)" : {
		compareDocumentPosition: function(node, other) {
			// http://www.w3.org/TR/DOM-Level-3-Core/core.html#Node3-compareDocumentPosition
			
			if (Traversal.contains(node, other)) {
				return 4|16; // following|contained_by
			} else if (Traversal.contains(other, node)) {
				return 2|8; // preceding|contains
			}
			
			var nodeIndex = this.$getSourceIndex(node);
			var otherIndex = this.$getSourceIndex(other);
			
			if (nodeIndex < otherIndex) {
				return 4; // following
			} else if (nodeIndex > otherIndex) {
				return 2; // preceding
			}			
			return 0;
		}
	}
}, {
	$getSourceIndex: function(node) {
		// return a key suitable for comparing nodes
		var key = 0;
		while (node) {
			key = Traversal.getNodeIndex(node) + "." + key;
			node = node.parentNode;
		}
		return key;
	},
	
	"@(element.sourceIndex)": {	
		$getSourceIndex: function(node) {
			return node.sourceIndex;
		}
	}
});

	

// =========================================================================
// core/Document.js
// =========================================================================

var Document = Node.extend(null, {
	bind: function(document) { //-dean
		this.base(document);
//-		// automatically bind elements that are created using createElement()
//-		extend(document, "createElement", function(tagName) {
//-			return _bind(this.base(tagName));
//-		});
		AbstractView.bind(document.defaultView);
		return document;
	}
});

// provide these as pass-through methods
Document.createDelegate("createElement");

// =========================================================================
// core/Element.js
// =========================================================================

// http://www.w3.org/TR/DOM-Level-3-Core/core.html#ID-745549614

// I'm going to fix getAttribute() for IE here instead of HTMLElement.

// getAttribute() will return null if the attribute is not specified. This is
//  contrary to the specification but has become the de facto standard.

var Element = Node.extend({
	"@MSIE[67]": {
		getAttribute: function(element, name) {
			if (element.className === undefined || name == "href" || name == "src") {
				return this.base(element, name, 2);
			}
			var attribute = element.getAttributeNode(name);
			return attribute && attribute.specified ? attribute.nodeValue : null;
		}
	},
	
	"@MSIE5.+win": {
		getAttribute: function(element, name) {
			if (element.className === undefined || name == "href" || name == "src") {
				return this.base(element, name, 2);
			}
			var attribute = element.attributes[this.$htmlAttributes[name.toLowerCase()] || name];
			return attribute ? attribute.specified ? attribute.nodeValue : null : this.base(element, name);
		}
	}
}, {
	$htmlAttributes: "",
	
	init: function() {
		// these are the attributes that IE is case-sensitive about
		// convert the list of strings to a hash, mapping the lowercase name to the camelCase name.
		// combine two arrays to make a hash
		var keys = this.$htmlAttributes.toLowerCase().split(",");
		var values = this.$htmlAttributes.split(",");
		this.$htmlAttributes = Array2.combine(keys, values);
	},
	
	"@MSIE5.+win": {
		$htmlAttributes: "colSpan,rowSpan,vAlign,dateTime,accessKey,tabIndex,encType,maxLength,readOnly,longDesc"
	}
});

Element.createDelegate("setAttribute");

// =========================================================================
// core/bind.js
// =========================================================================

extend(DOM, {
	bind: function(node) {
		// apply a base2 DOM Binding to a native DOM node
		switch (node.nodeType) {
			case 1: return Element.bind(node);
			case 9: return Document.bind(node);
			default: return Node.bind(node);
		}
		return node;
	}
});

var _bound = {}; // nodes that have already been extended (keep this private)
var _bind = function(node) {
	if (node) {
		var uid = assignID(node);
		if (!_bound[uid]) {
			DOM.bind(node);
			_bound[uid] = true;
		}
	}
	return node;
};

// =========================================================================
// views/AbstractView.js
// =========================================================================

// This is just fluff for now.

var AbstractView = Binding.extend();


// =========================================================================
// events/Event.js
// =========================================================================

// http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-Event

var Event = Binding.extend({	
	"@!(document.createEvent)": {
		initEvent: function(event, type, bubbles, cancelable) {
			event.type = type;
			event.bubbles = bubbles;
			event.cancelable = cancelable;
		},
		
		"@MSIE": {
			initEvent: function(event) {
				base(this, arguments);
				event.cancelBubble = !event.bubbles;
			},
			
			preventDefault: function(event) {
				if (event.cancelable !== false) {
					event.returnValue = false;
				}
			},
		
			stopPropagation: function(event) {
				event.cancelBubble = true;
			}
		}
	}
}, {
	"@MSIE": {		
		"@Mac": {
			bind: function(event) {
				// Mac IE5 does not allow expando properties on the event object so
				//  we copy the object instead.
				return this.base(extend({
					preventDefault: function() {
						if (this.cancelable !== false) {
							this.returnValue = false;
						}
					}
				}, event));
			}
		},
		
		"@Windows": {
			bind: function(event) {
				this.base(event);
				if (!event.target) {
					event.target = event.srcElement;
				}
				return event;
			}
		}
	}
});

// =========================================================================
// events/EventTarget.js
// =========================================================================

// http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-Registration-interfaces

var EventTarget = Interface.extend({
	"@!(element.addEventListener)": {
		addEventListener: function(target, type, listener) {
			// assign a unique id to both objects
			var $target = assignID(target);
			var $listener = listener.cloneID || assignID(listener);
			// create a hash table of event types for the target object
			var events = this.$all[$target];
			if (!events) events = this.$all[$target] = {};
			// create a hash table of event listeners for each object/event pair
			var listeners = events[type];
			var current = target["on" + type];
			if (!listeners) {
				listeners = events[type] = {};
				// store the existing event listener (if there is one)
				if (current) listeners[0] = current;
			}
			// store the event listener in the hash table
			listeners[$listener] = listener;
			if (current !== undefined) {
				target["on" + type] = this.$dispatch;
			}
		},
	
		dispatchEvent: function(target, event) {
			this.$dispatch.call(target, event);
		},
	
		removeEventListener: function(target, type, listener) {
			// delete the event listener from the hash table
			var events = this.$all[target.base2ID];
			if (events && events[type]) {
				delete events[type][listener.base2ID];
			}
		},
		
		"@MSIE.+win": {
			addEventListener: function(target, type, listener) {
				// avoid memory leaks
				this.base(target, type, bind(listener, target));
			},
			
			dispatchEvent: function(target, event) {
				event.target = target;
				try {
					target.fireEvent(event.type, event);
				} catch (error) {
					// the event type is not supported
					this.base(target, event);
				}
			}
		}
	}
}, {
	// support event dispatch	
	"@!(element.addEventListener)": {
		$all : {},
		
		$dispatch: function(event) {
			var returnValue = true;
			// get a reference to the hash table of event listeners
			var events = EventTarget.$all[this.base2ID];
			if (events) {
				event = Event.bind(event); // fix the event object
				var listeners = events[event.type];
				// execute each event listener
				for (var i in listeners) {
					returnValue = listeners[i].call(this, event);
					if (event.returnValue === false) returnValue = false;
					if (returnValue === false) break;
				}
			}
			return returnValue;
		},
	
		"@MSIE": {
			$dispatch: function(event) {
				if (!event) {
					var window = Window.verify(this) || Traversal.getDefaultView(this);
					event = window.event;
				}
				return this.base(event);
			}
		}
	}
});

// sprinkle some sugar on the static methods

extend(EventTarget, {
	addEventListener: function(target, type, listener, context) {
		// useCapture is not allowed as it not cross-platform
		//  (although there may be a way to mimic it for IE)
		
		// allow a different execution context for the event listener
		if (context) listener = bind(listener, context);
		// call the default method
		this.base(target, type, listener, false);
	},

	dispatchEvent: function(target, event) {
		// allow the second argument to be a string identifying the type of
		//  event and construct an event object automatically, this is handy for
		//  custom events
		if (typeof event == "string") {
			var type = event;
			var document = Traversal.getDocument(target);
			event = DocumentEvent.createEvent(document, "Events");
			Event.initEvent(event, type, false, false);
		}
		// call the default method
		this.base(target, event);
	}
});

// =========================================================================
// events/DocumentEvent.js
// =========================================================================

// http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-DocumentEvent
var DocumentEvent = Interface.extend({	
	"@!(document.createEvent)": {
		createEvent: function(document) {
			return Event.bind({});
		},
	
		"@(document.createEventObject)": {
			createEvent: function(document) {
				return Event.bind(document.createEventObject());
			}
		}
	},
	
	"@KHTML": {
		createEvent: function(document, type) {
			// a type of "Events" throws an error on Safari (need to check current builds)
			return this.base(document, type == "Events" ? "UIEvents" : type);
		}
	}
});

// =========================================================================
// events/DOMContentLoaded.js
// =========================================================================

// http://dean.edwards.name/weblog/2006/06/again

var DOMContentLoaded = new Base({
	fired: false,
	
	fire: function() {
		if (!DOMContentLoaded.fired) {
			DOMContentLoaded.fired = true;
			// this function might be called from another event handler so we'll user a timer
			//  to drop out of any current event.
			// eval a string for ancient browsers
			setTimeout("base2.EventTarget.dispatchEvent(document,'DOMContentLoaded')", 0);
		}
	},
	
	init: function() {
		// use the real event for browsers that support it (opera & firefox)
		EventTarget.addEventListener(document, "DOMContentLoaded", function() {
			DOMContentLoaded.fired = true;
		});
		// if all else fails fall back on window.onload
		EventTarget.addEventListener(window, "load", DOMContentLoaded.fire);
	},

	"@(addEventListener)": {
		init: function() {
			this.base();
			addEventListener("load", DOMContentLoaded.fire, false);
		}
	},

	"@(attachEvent)": {
		init: function() {
			this.base();
			attachEvent("onload", DOMContentLoaded.fire);
		}
	},

	"@MSIE.+win": {
		init: function() {
			this.base();
			// Matthias Miller/Mark Wubben/Paul Sowden/Me
			document.write("<script id=__ready defer src=//:><\/script>");
			document.all.__ready.onreadystatechange = function() {
				if (this.readyState == "complete") {
					this.removeNode(); // tidy
					DOMContentLoaded.fire();
				}
			};
		}
	},
	
	"@KHTML": {
		init: function() {
			this.base();
			// John Resig
			var timer = setInterval(function() {
				if (/loaded|complete/.test(document.readyState)) {
					clearInterval(timer);
					DOMContentLoaded.fire();
				}
			}, 100);
		}
	}
});

DOMContentLoaded.init();

// =========================================================================
// style/ViewCSS.js
// =========================================================================

// http://www.w3.org/TR/DOM-Level-2-Style/css.html#CSS-ViewCSS

var ViewCSS = Interface.extend({
	"@!(getComputedStyle)": {
		getComputedStyle: function(view, element) {
			// pseudoElement parameter is not supported
			return element.currentStyle; //-dean - fix this object too
		}
	}
}, {
	toCamelCase: function(string) {
		return String(string).replace(/\-([a-z])/g, function(match, chr) {
			return chr.toUpperCase();
		});
	}
});

// =========================================================================
// style/bind.js
// =========================================================================

extend(Document, {
	"@!(document.defaultView)": {
		bind: function(document) {
			document.defaultView = Traversal.getDefaultView(document);
			this.base(document);
			return document;
		}
	}
});

// =========================================================================
// selectors-api/NodeSelector.js
// =========================================================================

// http://www.w3.org/TR/selectors-api/
// http://www.whatwg.org/specs/web-apps/current-work/#getelementsbyclassname

var NodeSelector = Interface.extend({	
	"@!(element.getElementsByClassName)": { // firefox3?
		getElementsByClassName: function(node, className) {
			if (instanceOf(className, Array)) {
				className = className.join(".");
			}
			return this.matchAll(node, "." + className);
		}
	},
	
	"@!(element.matchSingle)": { // future-proof
		matchAll: function(node, selector) {
			return new Selector(selector).exec(node);
		},
		
		matchSingle: function(node, selector) {
			return new Selector(selector).exec(node, 1);
		}
	}
});

// automatically bind objects retrieved using the Selectors API

extend(NodeSelector.prototype, {
	matchAll: function(selector) {
		return extend(this.base(selector), "item", function(index) {
			return _bind(this.base(index));
		});
	},
	
	matchSingle: function(selector) {
		return _bind(this.base(selector));
	}
});

// =========================================================================
// selectors-api/DocumentSelector.js
// =========================================================================

// http://www.w3.org/TR/selectors-api/#documentselector

var DocumentSelector = NodeSelector.extend();


// =========================================================================
// selectors-api/ElementSelector.js
// =========================================================================

// more Selectors API sensibleness

var ElementSelector = NodeSelector.extend({
	"@!(element.matchesSelector)": { // future-proof
		matchesSelector: function(element, selector) {
			return new Selector(selector).test(element);
		}
	}
});


// =========================================================================
// selectors-api/StaticNodeList.js
// =========================================================================

// http://www.w3.org/TR/selectors-api/#staticnodelist

// A wrapper for an array of elements or an XPathResult.
// The item() method provides access to elements.
// Implements Enumerable so you can forEach() to your heart's content... :-)

var StaticNodeList = Base.extend({
	constructor: function(nodes) {
		nodes = nodes || [];
		this.length = nodes.length;
		this.item = function(index) {
			return nodes[index];
		};
	},
	
	length: 0,
	
	forEach: function(block, context) {
		var length = this.length; // preserve
		for (var i = 0; i < length; i++) {
			block.call(context, this.item(i), i, this);
		}
	},
	
	item: function(index) {
		// defined in the constructor function
	},
	
	"@(XPathResult)": {
		constructor: function(nodes) {
		//-	if (nodes instanceof XPathResult) { // doesn't work in Safari
			if (nodes && nodes.snapshotItem) {
				this.length = nodes.snapshotLength;
				this.item = function(index) {
					return nodes.snapshotItem(index);
				};
			} else this.base(nodes);
		}
	}
});

StaticNodeList.implement(Enumerable);

// =========================================================================
// selectors-api/Selector.js
// =========================================================================

// This object can be instantiated, however it is probably better to use
// the matchAll/matchSingle methods on DOM nodes.

// There is no public standard for this object. It just separates the NodeSelector
//  interface from the complexity of the Selector parsers.

var Selector = Base.extend({
	constructor: function(selector) {
		this.toString = function() {
			return trim(selector);
		};
	},
	
	exec: function(context, single) {
	//	try {
			var result = this.$evaluate(context || document, single);
	//	} catch (error) { // probably an invalid selector =)
	//		throw new SyntaxError(format("'%1' is not a valid CSS selector.", this));
	//	}
		return single ? result : new StaticNodeList(result);
	},
	
	test: function(element) {
		//-dean: improve this for simple selectors
		element.setAttribute("b2_test", true);
		var selector = new Selector(this + "[b2_test]");
		var result = selector.exec(Traversal.getOwnerDocument(element), 1);
		element.removeAttribute("b2_test");
		return result == element;
	},
	
	$evaluate: function(context, single) {
		return Selector.parse(this)(context, single);
	}
});

// =========================================================================
// selectors-api/Parser.js
// =========================================================================
	
var Parser = RegGrp.extend({
	constructor: function() {
		base(this, arguments);
		this.cache = {};
		this.sorter = new RegGrp;
		this.sorter.add(/:not\([^)]*\)/, RegGrp.IGNORE);
		this.sorter.add(/([ >](\*|[\w-]+))([^: >+~]*)(:\w+-child(\([^)]+\))?)([^: >+~]*)/, "$1$3$6$4");
	},
	
	cache: null,
	ignoreCase: true,
	
	escape: function(selector) {
		// remove strings
		var strings = this._strings = [];
		return this.optimise(this.format(String(selector).replace(Parser.ESCAPE, function(string) {
			strings.push(string.slice(1, -1));
			return "%" + strings.length;
		})));
	},
	
	format: function(selector) {
		return selector
			.replace(Parser.WHITESPACE, "$1")
			.replace(Parser.IMPLIED_SPACE, "$1 $2")
			.replace(Parser.IMPLIED_ASTERISK, "$1*$2");
	},
	
	optimise: function(selector) {
		// optimise wild card descendant selectors
		return this.sorter.exec(selector.replace(Parser.WILD_CARD, ">* "));
	},
	
	parse: function(selector) {
		return this.cache[selector] ||
			(this.cache[selector] = this.unescape(this.exec(this.escape(selector))));
	},
	
	unescape: function(selector) {
		// put string values back
		return format(selector, this._strings);
	}
}, {
	ESCAPE:           /(["'])[^\1]*\1/g,
	IMPLIED_ASTERISK: /([\s>+~,]|[^(]\+|^)([#.:@])/g,
	IMPLIED_SPACE:    /(^|,)([^\s>+~])/g,
	WHITESPACE:       /\s*([\s>+~(),]|^|$)\s*/g,
	WILD_CARD:        /\s\*\s/g,
	
	_nthChild: function(match, args, position, last, not, and, mod, equals) {
		// ugly but it works
		last = /last/i.test(match) ? last + "+1-" : "";
		if (!isNaN(args)) args = "0n+" + args;
		else if (args == "even") args = "2n";
		else if (args == "odd") args = "2n+1";
		args = args.split(/n\+?/);
		var a = (args[0] == "") ? 1 : (args[0] == "-") ? -1 : parseInt(args[0]);
		var b = parseInt(args[1]) || 0;
		var not = a < 0;
		if (not) {
			a = -a;
			if (a == 1) b++;
		}
		var query = format(a == 0 ? "%3%7" + (last + b) : "(%4%3-%2)%6%1%70%5%4%3>=%2", a, b, position, last, and, mod, equals);
		if (not) query = not + "(" + query + ")";
		return query;
	}
});

// =========================================================================
// selectors-api/Selector/operators.js
// =========================================================================

Selector.operators = {
	"=":  "%1=='%2'",
	"~=": /(^| )%1( |$)/,
	"|=": /^%1(-|$)/,
	"^=": /^%1/,
	"$=": /%1$/,
	"*=": /%1/
};

Selector.operators[""] = "%1!=null";

// =========================================================================
// selectors-api/Selector/pseudoClasses.js
// =========================================================================

Selector.pseudoClasses = { //-dean: lang()
	"checked":     "e%1.checked",	
	"contains":    "Traversal.getTextContent(e%1).indexOf('%2')!=-1",	
	"disabled":    "e%1.disabled",	
	"empty":       "Traversal.isEmpty(e%1)",	
	"enabled":     "e%1.disabled===false",	
	"first-child": "!Traversal.getPreviousElementSibling(e%1)",
	"last-child":  "!Traversal.getNextElementSibling(e%1)",	
	"only-child":  "!Traversal.getPreviousElementSibling(e%1)&&!Traversal.getNextElementSibling(e%1)",	
	"root":        "e%1==Traversal.getDocument(e%1).documentElement"	
/*	"lang": function(element, lang) {
		while (element && !element.getAttribute("lang")) {
			element = element.parentNode;
		}
		return element && lang.indexOf(element.getAttribute("lang")) == 0;
	}, */
};

// =========================================================================
// selectors-api/Selector/parse.js
// =========================================================================

// CSS parser - converts CSS selectors to DOM queries.

// Hideous code but it produces fast DOM queries.
// Respect due to Alex Russell and Jack Slocum for inspiration.

// TO DO:
// * sort nodes into document order (comma separated queries only)

new function(_) {	
	// some constants
	var MSIE = BOM.detect("MSIE");
	var MSIE5 = BOM.detect("MSIE5");
	var INDEXED = BOM.detect("(element.sourceIndex)") ;
	var VAR = "var p%2=0,i%2,e%2,n%2=e%1.";
	var ID = INDEXED ? "e%1.sourceIndex" : "assignID(e%1)";
	var TEST = "var g=" + ID + ";if(!p[g]){p[g]=1;";
	var STORE = "r[r.length]=e%1;if(s)return e%1;";
	var FN = "fn=function(e0,s){indexed={};var r=[],p={},reg=[%1]," +
		"d=Traversal.getDocument(e0),c=d.body?'toUpperCase':'toString';";
	
	// IE confuses the name attribute with id for form elements,
	// use document.all to retrieve all elements with name/id instead
	var getElementById = MSIE ? function(document, id) {
		var result = document.all[id] || null;
		// returns a single element or a collection
		if (!result || result.id == id) return result;
		// document.all has returned a collection of elements with name/id
		for (var i = 0; i < result.length; i++) {
			if (result[i].id == id) return result[i];
		}
		return null;
	} : function(document, id) {
		return document.getElementById(id);
	};
	
	// register a node and index its children
	//  store the indexes in a hash, it is faster to augment the element itself but
	//  that just seems dirty
	var indexed = {};
	function register(element) {
		var uid = INDEXED ? element.sourceIndex : assignID(element);
		if (!indexed[uid]) {
			var elements = indexed[uid] = {};
			var children = MSIE ? element.children || element.childNodes : element.childNodes;
			var index = 0;
			var child;
			for (var i = 0; (child = children[i]); i++) {
				if (Traversal.isElement(child)) {
					elements[INDEXED ? child.sourceIndex : assignID(child)] = ++index;
				}
			}
			elements.length = index;
		}
		return uid;
	};
	
	// variables used by the parser
	var fn;
	var index; 
	var reg; // a store for RexExp objects
	var wild; // need to flag certain wild card selectors as MSIE includes comment nodes
	var list; // are we processing a node list?
	var dup; // possible duplicates?
	var cache = {}; // store parsed selectors
	
	// a hideous parser
	var parser = new Parser({
		"^ \\*:root": function(match) {
			wild = false;
			var replacement = "e%2=d.documentElement;if(Traversal.contains(e%1,e%2)){";
			return format(replacement, index++, index);
		},
		" (\\*|[\\w-]+)#([\\w-]+)": function(match, tagName, id) {
			wild = false;
			var replacement = "var e%2=getElementById(d,'%4');if(e%2&&";
			if (tagName != "*") replacement += "e%2.nodeName=='%3'[c]()&&";
			replacement += "Traversal.contains(e%1,e%2)){";
			if (list) replacement += format("i%1=n%1.length;", list);
			return format(replacement, index++, index, tagName, id);
		},
		" (\\*|[\\w-]+)": function(match, tagName) {
			dup++; // this selector may produce duplicates
			wild = tagName == "*";
			var replacement = VAR;
			// IE5.x does not support getElementsByTagName("*");
			replacement += (wild && MSIE5) ? "all" : "getElementsByTagName('%3')";
			replacement += ";for(i%2=0;(e%2=n%2[i%2]);i%2++){";
			return format(replacement, index++, list = index, tagName);
		},
		">(\\*|[\\w-]+)": function(match, tagName) {
			var children = MSIE && list;
			wild = tagName == "*";
			var replacement = VAR;
			// use the children property for MSIE as it does not contain text nodes
			//  (but the children collection still includes comments).
			// the document object does not have a children collection
			replacement += children ? "children": "childNodes";
			if (!wild && children) replacement += ".tags('%3')";
			replacement += ";for(i%2=0;(e%2=n%2[i%2]);i%2++){";
			if (wild) {
				replacement += "if(e%2.nodeType==1){";
				wild = MSIE5;
			} else {
				if (!children) replacement += "if(e%2.nodeName=='%3'[c]()){";
			}
			return format(replacement, index++, list = index, tagName);
		},
		"([+~])(\\*|[\\w-]+)": function(match, combinator, tagName) {
			var replacement = "";
			if (wild && MSIE) replacement += "if(e%1.tagName!='!'){";
			wild = false;
			var direct = combinator == "+";
			if (!direct) {
				replacement += "while(";		
				dup = 2; // this selector may produce duplicates
			}
			replacement += "e%1=Traversal.getNextElementSibling(e%1)";
			replacement += (direct ? ";" : "){") + "if(e%1";
			if (tagName != "*") replacement += "&&e%1.nodeName=='%2'[c]()";
			replacement += "){";
			return format(replacement, index, tagName);
		},
		"#([\\w-]+)": function(match, id) {
			wild = false;
			var replacement = "if(e%1.id=='%2'){";		
			if (list) replacement += format("i%1=n%1.length;", list);
			return format(replacement, index, id);
		},
		"\\.([\\w-]+)": function(match, className) {
			wild = false;
			// store RegExp objects - slightly faster on IE
			reg.push(new RegExp("(^|\\s)" + rescape(className) + "(\\s|$)"));
			return format("if(reg[%2].test(e%1.className)){", index, reg.length - 1);
		},
		":not\\((\\*|[\\w-]+)?([^)]*)\\)": function(match, tagName, filters) {
			var replacement = (tagName && tagName != "*") ? format("if(e%1.nodeName=='%2'[c]()){", index, tagName) : "";
			replacement += parser.exec(filters);
			return "if(!" + replacement.slice(2, -1).replace(/\)\{if\(/g, "&&") + "){";
		},
		":nth(-last)?-child\\(([^)]+)\\)": function(match, last, args) {
			wild = false;
			last = format("indexed[p%1].length", index);
			var replacement = "if(p%1!==e%1.parentNode.";
			replacement += INDEXED ? "sourceIndex" : "base2ID";
			replacement += ")p%1=register(e%1.parentNode);var i=indexed[p%1][" + ID + "];if(";
			return format(replacement, index) + Parser._nthChild(match, args, "i", last, "!", "&&", "%", "==") + "){";
		},
		":([\\w-]+)(\\(([^)]+)\\))?": function(match, pseudoClass, $2, args) {
			return "if(" + format(Selector.pseudoClasses[pseudoClass], index, args || "") + "){";
		},
		"\\[([\\w-]+)\\s*([^=]?=)?\\s*([^\\]]*)\\]": function(match, attr, operator, value) {
			if (operator) {
				if (attr == "class") attr == "className";
				else if (attr == "for") attr == "htmlFor";
				attr = format("(e%1.getAttribute('%2')||e%1['%2'])", index, attr);
			} else {
				attr = format("Element.getAttribute(e%1,'%2')", index, attr);
			} 
			var replacement = Selector.operators[operator || ""];
			if (instanceOf(replacement, RegExp)) {
				reg.push(new RegExp(format(replacement.source, rescape(parser.unescape(value)))));
				replacement = "reg[%2].test(%1)";
				value = reg.length - 1;
			}
			return "if(" + format(replacement, attr, value) + "){";
		}
	});
	
	// return the parse() function
	Selector.parse = function(selector) {
		if (!cache[selector]) {
			reg = []; // store for RegExp objects
			fn = "";
			var selectors = parser.escape(selector).split(",");
			forEach (selectors, function(selector, label) {
				index = list = dup = 0; // reset
				var block = parser.exec(selector);
				if (wild && MSIE) { // IE's pesky comment nodes
					block += format("if(e%1.tagName!='!'){", index);
				}
				var store = (label || dup > 1) ? TEST : "";
				block += format(store + STORE, index);
				var braces = match(block, /\{/g).length;
				while (braces--) block += "}";
				fn += block;
			});
			eval(format(FN, reg) + parser.unescape(fn) + "return s?null:r}");
			cache[selector] = fn;
		}
		return cache[selector];
	};
};

// =========================================================================
// DOM/implementations.js
// =========================================================================

AbstractView.implement(ViewCSS);

Document.implement(DocumentSelector);
Document.implement(DocumentEvent);
Document.implement(EventTarget);

Element.implement(ElementSelector);
Element.implement(EventTarget);

// =========================================================================
// html/HTMLDocument.js
// =========================================================================

// http://www.whatwg.org/specs/web-apps/current-work/#htmldocument
// http://www.whatwg.org/specs/web-apps/current-work/#getelementsbyclassname

var HTMLDocument = Document.extend({
	"@!(document.nodeType)": {
		nodeType: 9
	}
}, {
	// http://www.whatwg.org/specs/web-apps/current-work/#activeelement	
	"@(document.activeElement===undefined)": {
		bind: function(document) {
			this.base(document);
			document.activeElement = null;
			document.addEventListener("focus", function(event) { //-dean: is onfocus good enough?
				document.activeElement = event.target;
			}, false);
			return document;
		}
	}
});

// =========================================================================
// html/HTMLElement.js
// =========================================================================

// http://www.whatwg.org/specs/web-apps/current-work/#getelementsbyclassname

var HTMLElement = Element.extend({
	addClass: function(element, className) {
		if (!this.hasClass(element, className)) {
			element.className += (element.className ? " " : "") + className;
			return className;
		}
	},
	
	hasClass: function(element, className) {
		var regexp = new RegExp("(^|\\s)" + className + "(\\s|$)");
		return regexp.test(element.className);
	},

	removeClass: function(element, className) {
		var regexp = new RegExp("(^|\\s)" + className + "(\\s|$)");
		element.className = element.className.replace(regexp, "$2");
		return className;
	}	
}, {
	bindings: {},
	tags: "*",
	
	extend: function() {
		// maintain HTML element bindings.
		// this allows us to map specific interfaces to elements by reference
		// to tag name.
		var binding = base(this, arguments);
		var tags = (binding.tags || "").toUpperCase().split(",");
		forEach (tags, function(tagName) {
			HTMLElement.bindings[tagName] = binding;
		});
		return binding;
	},
	
	"@!(element.ownerDocument)": {
		bind: function(element) {
			this.base(element);
			element.ownerDocument = Traversal.getOwnerDocument(element);
			return element;
		}
	}
});

// =========================================================================
// html/bind.js
// =========================================================================

extend(DOM, "bind", function(node) {
	if (typeof node.className == "string") {
		// it's an HTML element, use bindings based on tag name
		(HTMLElement.bindings[node.tagName] || HTMLElement).bind(node);
	} else if (node.body !== undefined) {
		HTMLDocument.bind(node);
	} else {
		this.base(node);
	}
	return node;
});

eval(this.exports);

}; ////////////////////  END: CLOSURE  /////////////////////////////////////