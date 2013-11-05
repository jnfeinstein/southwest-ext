//BGcall from AdBlock
BGcall = function() {
  var args = [];
  for (var i=0; i < arguments.length; i++)
    args.push(arguments[i]);
  var fn = args.shift();
  var has_callback = (typeof args[args.length - 1] == "function");
  var callback = (has_callback ? args.pop() : function() {});
  chrome.runtime.sendMessage({command: "call", fn:fn, args:args}, callback);
};