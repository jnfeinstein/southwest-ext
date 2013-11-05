$(function() {
  window.checkins = $.noop;
   checkins.execute = (function() {
    var _checkin_stage_1 = function(details) {
      var data = {
        confirmationNumber: details.confirmation,
        firstName: details.first_name,
        lastName: details.last_name,
        submitButton: 'Check In'
      };
      return $.post('http://www.southwest.com/flight/retrieveCheckinDoc.html', data);
    };

    var _checkin_stage_2 = function() {
      var data = {
        'checkinPassengers[0].selected': true,
        printDocuments: 'Check In'
      };
      return $.post('http://www.southwest.com/flight/selectPrintDocument.html', data);
    };

    return function(details) {
      var deferred = $.Deferred();
      _checkin_stage_1(details)
      .done(function(data) {
        _checkin_stage_2().done(function() {
          deferred.resolve();
        });
      })
      .fail(function() {
        deferred.reject();
      });
      return deferred.promise();
    };
  })();

  checkins.schedule = (function() {
    var alarm_functions = {};

    chrome.alarms.onAlarm.addListener(function(alarm) {
      if (func = alarm_functions[alarm.name])
        func();
    });

    return function(time, details) {
      var alarm_name = JSON.stringify(details);
      var alarm_time = new Date(time).getTime();
      var alarm_func = function() {
        delete alarm_functions[alarm_name];
        checkins.send();
        checkins.execute(details);
      };
      chrome.alarms.create(alarm_name, {when: alarm_time});
      alarm_functions[alarm_name] = alarm_func;
      checkins.send();
    };
  })();

  checkins.get = function() {
    var deferred = $.Deferred();
    chrome.alarms.getAll(function(alarms) {
      deferred.resolve(alarms);
    });
    return deferred.promise();
  };

  checkins.cancel = function(details) {
    var alarm_name = JSON.stringify(details);
    chrome.alarms.clear(alarm_name);
    checkins.send();
  };

  checkins.send = function() {
    checkins.get().then(function(alarms) {
      var scheduled = _.map(alarms, function(alarm) {
        return _.extend(JSON.parse(alarm.name), {time: alarm.scheduledTime});
      });
      chrome.runtime.sendMessage({command: "scheduled:sending", scheduled: scheduled});
    });
  };
});

var schedule_checkin = function() {
  checkins.schedule.apply(checkins, arguments);
};

// BGcall dispatch from AdBlock
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (sender.tab == null)
      return;
    if (request.command == 'call') {
      var fn = window[request.fn];
      request.args.push(sender);
      var result = fn.apply(window, request.args);
      sendResponse(result);
    }
    else if (request.command == 'scheduled:asking') {
      checkins.send();
    }
    else if (request.command == 'scheduled:cancel') {
      checkins.cancel(request.details);
    }
  }
);

chrome.browserAction.onClicked.addListener(function(tab) {
  chrome.tabs.create({url:chrome.extension.getURL("main.html")});
});
