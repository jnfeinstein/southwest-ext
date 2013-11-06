$(function() {
  window.app = $.noop;
  app.Model = Backbone.Epoxy.Model.extend({
    defaults: {
      confirmation: '',
      first_name: '',
      last_name: ''
    },
    get_details: function() {
      return this.toJSON();
    },
    reset: function() {
      this.set(_.result(this, 'defaults'));
    }
  });
  app.ScheduleView = Backbone.Epoxy.View.extend({
    model: new app.Model(),
    bindings: {
      'div.field.confirmation input': 'value:confirmation',
      'div.field.first_name input': 'value:first_name',
      'div.field.last_name input': 'value:last_name',
    },
    events: {
      'click button.submit': 'do_checkin'
    },
    initialize: function() {
      _.bindAll(this, 'do_checkin');
      var datetimepicker = this.$el.find('div#datetimepicker').datetimepicker();
      this.datetimepicker = datetimepicker.data('DateTimePicker');
      this.reset();
    },
    reset: function() {
      this.model.reset();
      this.datetimepicker.setStartDate(moment().toDate());
      this.datetimepicker.setDate(moment().add(1, 'd'));
    },
    do_checkin: function() {
      BGcall('schedule_checkin', this.datetimepicker.getDate(), this.model.get_details());
      this.reset();
      app.content_view.toggle_views();
    }
  });
  app.RowView = Backbone.Epoxy.View.extend({
    tagName: 'tr',
    template: _.template($('script.row.template').html()),
    events: {
      'click td.remove > span': 'destroy'
    },
    initialize: function() {
      _.bindAll(this, 'destroy');
      this.$el.append(this.template(this.model.toJSON()));
    },
    destroy: function() {
      app.remove_scheduled_checkin(this.model.get_details());
    }
  });
  app.TableCollection = Backbone.Collection.extend({
    view: app.RowView,
    model: app.Model
  })
  app.TableView = Backbone.Epoxy.View.extend({
    collection: new app.TableCollection(),
    bindings: { 'table > tbody': 'collection:$collection' }
  });
  app.ContentView = Backbone.Epoxy.View.extend({
    events: {
      'click span.toggle': 'toggle_views'
    },
    initialize: function() {
      _.bindAll(this, 'toggle_views');
      this.schedule_view = new app.ScheduleView({el: 'div.content.scheduler'});
      this.table_view = new app.TableView({el: 'div.content.table'});
      this.table_view.$el.hide();
    },
    toggle_views: function() {
      var first, second;
      if (this.schedule_view.$el.is(':visible')) {
        first = this.schedule_view;
        second = this.table_view;
      }
      else {
        first = this.table_view;
        second = this.schedule_view;       
      }
      first.$el.toggle(80, function() {
        second.$el.toggle(80);
      });
    }
  });
  app.set_scheduled_checkins = function(scheduled) {
    app.content_view.table_view.collection.reset(scheduled);
  };
  app.fetch_scheduled_checkins = function() {
    chrome.runtime.sendMessage({command: "scheduled:asking"});
  };
  app.remove_scheduled_checkin = function(details) {
    chrome.runtime.sendMessage({command: "scheduled:cancel", details: details});
  };
  $(document).ready(function() {
    app.content_view = new app.ContentView({el: 'div.content.main'});
    app.fetch_scheduled_checkins();
  });
});

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.command == 'scheduled:sending') {
      app.set_scheduled_checkins(request.scheduled);
    }
  }
);
