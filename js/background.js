$(function() {
  window.checkins = function() {};
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

  checkins.alarm_functions = {};
  checkins.schedule = (function() {
    chrome.alarms.onAlarm.addListener(function(alarm) {
      var func = checkins.alarm_functions[alarm.name];
      if (func) func();
    });

    return function(time, details) {
      var alarm_name = JSON.stringify(details);
      var alarm_time = new Date(time).getTime();
      var checkin_func = function() { checkins.execute(details); };
      var alarm_func = function() {
        checkins.cancel(alarm_name);
        checkin_func();
        _.each([15, 30, 60], function(s) { setTimeout(checkin_func, s * 1000); });
      };
      chrome.alarms.create(alarm_name, {when: alarm_time});
      checkins.alarm_functions[alarm_name] = alarm_func;
      $(checkins).trigger('changed');
    };
  })();

  checkins.get = function() {
    var deferred = $.Deferred();
    chrome.alarms.getAll(function(alarms) {
      var valid_alarms = _.filter(alarms, function(alarm) { return checkins.alarm_functions[alarm.name]; });
      deferred.resolve(valid_alarms);
    });
    return deferred.promise();
  };

  checkins.cancel = function(alarm_name) {
    delete checkins.alarm_functions[alarm_name];
    chrome.alarms.clear(alarm_name);
    $(checkins).trigger('changed');
  };

  checkins.send = function() {
    checkins.get().then(function(alarms) {
      var scheduled = _.map(alarms, function(alarm) {
        return _.extend(JSON.parse(alarm.name), {time: alarm.scheduledTime});
      });
      chrome.runtime.sendMessage({command: "scheduled:sending", scheduled: scheduled});
    });
  };

  $(checkins).on('changed', checkins.send);
});

$(function() {
  window.management = function() {};
  management.scrub_checkins = function() {
    var deferred = $.Deferred();
    checkins.get().then(function(alarms) {
      var current_time = new Date().getTime();
      var grouped_alarms = _.groupBy(alarms, function(alarm) { return current_time > alarm.scheduledTime; });
      _.each(grouped_alarms.true || [], function(alarm) {
        var func = checkins.alarm_functions[alarm.name];
        checkins.cancel(alarm.name);
        if (func) func();
      });
      deferred.resolve(grouped_alarms.false);
    });
    return deferred.promise();
  };

  management.set_keep_awake = (function() {
    var power_level = 'system';
    return function(keep_awake) {
      keep_awake ? chrome.power.requestKeepAwake('system') : chrome.power.releaseKeepAwake(); 
    };
  })();

  management.set_periodic_monitoring = (function() {
    var alarm_name = 'scrub_alarm';
    var alarm_period = 2;
    chrome.alarms.onAlarm.addListener(function(alarm) {
      if (alarm.name != alarm_name) return;
      management.run_management();
    });
    return function(monitor) {
      chrome.alarms.get(alarm_name, function(alarm) {
        if (alarm && !monitor)
          chrome.alarms.clear(alarm_name);
        else if (!alarm && monitor)
          chrome.alarms.create(alarm_name, {periodInMinutes: alarm_period});
      });
    };
  })();

  management.run_management = function() {
    management.scrub_checkins().then(function(alarms) {
      var stay_active = _.any(alarms);
      management.set_keep_awake(stay_active);
      management.set_periodic_monitoring(stay_active)
    });
  };

  $(checkins).on('changed', management.run_management);
});

var schedule_checkin = function() {
  checkins.schedule.apply(checkins, arguments);
};

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
      if (request.details.time) delete request.details.time;
      checkins.cancel(JSON.stringify(request.details));
    }
  }
);

chrome.browserAction.onClicked.addListener(function(tab) {
  chrome.tabs.create({url:chrome.extension.getURL("main.html")});
});
