// Testing annotation widget with touch events.

(function () {
  'use strict';

// ------------------------------------------------------------------------------
// I intend to have only one object
  function MobileAnnotationWidget () {
    var size = '80px';
    if (SAM.detectMobile() === 'iPhone') {
      size = '100px';
    }

    // TODO: The css style is not working for mobile devices. fix it.
    // for now, hack back in the size dependancies.

    var self = this;
    this.Div =
        $('<div>').appendTo(SA.VIEWERS[0].GetDiv())
        .css({'position': 'absolute',
          'right': '0px',
          'bottom': '0px',
          'z-index': '5'});

    // .addClass("sa-view-annotation-div ui-responsive")

    // I cannot get touch events that start in the image to continue in
    // the document / viewer.  Press to place, then interact to position.
    this.CircleButton = $('<img>')
        .appendTo(this.Div)
        .css({'height': size,
          'width': size,
          'opacity': '0.6',
          'margin': '1px',
          'padding': '5px'})
        // .addClass("sa-view-annotation-button")
        .attr('src', SA.ImagePathUrl + 'Circle128.jpg')
        .on('touchend', function () { self.CircleCallback(); });
    this.CircleButton.prop('title', 'Circle Annotation');

    this.TextButton = $('<img>')
        .appendTo(this.Div)
        .css({'height': size,
          'width': size,
          'opacity': '0.6',
          'margin': '1px',
          'padding': '5px'})
        // .addClass("sa-view-annotation-button")
        .attr('src', SA.ImagePathUrl + 'Text128.jpg')
        .on('touchend', function () { self.TextCallback(); });
    this.TextButton.prop('title', 'Text Annotation');

    this.Visibility = false;

    // SA.OnStartInteraction( function () { self.SetVisibility(false);} );
  }

  MobileAnnotationWidget.prototype.CircleCallback = function () {
    console.log('New circle');

    // Hard code only a single view for now.
    this.Layer = SA.VIEWERS[0].GetAnnotationLayer();

    if (this.Layer.ActiveWidget !== undefined) {
      this.Layer.ActiveWidget.Deactivate();
    }
    var widget = new SAM.CircleWidget(this.Layer, false);
    var cam = this.Layer.GetCamera();
    var x = cam.FocalPoint[0];
    var y = cam.FocalPoint[1];

    widget.Shape.Origin = [x, y];
    widget.Shape.Radius = cam.Height / 4.0;
    widget.Shape.UpdateBuffers(this.Layer.AnnotationView);
    this.Layer.EventuallyDraw();

    this.Layer.SetVisibility(true);
  };

  MobileAnnotationWidget.prototype.TextCallback = function () {
    this.Layer = SA.VIEWERS[0].GetAnnotationLayer();
    var widget = this.Layer.ActiveWidget;
    if (widget) {
      widget.Deactivate();
    }

    this.Layer.SetVisibility(true);
    widget = new SAM.TextWidget(this.Layer, '');
    var cam = this.Layer.GetCamera();
    var x = cam.FocalPoint[0];
    var y = cam.FocalPoint[1];
    widget.Text.Anchor[0] = x;
    widget.Text.Anchor[1] = y;
    this.Layer.EventuallyDraw();

    this.Layer.ActivateWidget(widget);

    // The dialog is used to set the initial text.
    widget.ShowPropertiesDialog();
  };

// Show the tool gui.
  MobileAnnotationWidget.prototype.SetVisibility = function (v) {
    this.Visibility = v;
    if (v) {
      this.Div.show();
    } else {
      this.Div.hide();
    }
  };

// Toggle the tool gui.
  MobileAnnotationWidget.prototype.ToggleVisibility = function () {
    this.SetVisibility(!this.Visibility);
  };

  SA.MobileAnnotationWidget = MobileAnnotationWidget;
})();
