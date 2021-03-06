// TODO:
// Record id when creating a new annotation.
// Finish polyline "NewAnnotationItem"
// Load annotation into layer when circle is clicked on.
// Right click menu to "delete, modify (record over), set name.
// Hover over circle to see annotation name.
// Finish remaining annotation items.
// Add camera view as annotation.

(function () {
  'use strict';

  function GirderWidget (layer, itemId) {
    if (itemId) {
      this.ImageItemId = itemId;
      this.LoadGirderImageItem(itemId);
    }
    this.Radius = 7;
    this.AnnotationLayer = layer;
    document.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    }, false);

    var idx = 0;
    var y = 70 + (idx * 6 * this.Radius);
    var self = this;
    this.Plus = $('<img>')
      .appendTo(this.AnnotationLayer.GetCanvasDiv())
      .attr('src', SA.ImagePathUrl + 'bluePlus.png')
      .css({
        'position': 'absolute',
        'left': (3 * this.Radius) + 'px',
        'top': y + 'px',
        'width': (2 * this.Radius) + 'px',
        'height': (2 * this.Radius) + 'px',
        'opacity': '0.6'})
      .prop('title', 'Add Annotation')
      .hover(function () { $(this).css({'opacity': '1'}); },
             function () { $(this).css({'opacity': '0.6'}); })
      .click(function (e) { self.NewAnnotationItem(e); });

    this.AnnotationObjects = [];
    this.Highlighted = undefined;

    this.MenuAnnotationObject = undefined;
    this.Menu = $('<div>')
      .appendTo(this.AnnotationLayer.GetCanvasDiv())
      .hide()
      .mouseleave(function () { $(this).hide(); })
      .css({
        'position': 'absolute',
        'background-color': '#FFFFFF',
        'border': '1px solid #666666',
        'box-sizing': 'border-box',
        'left': '-78px',
        'width': '100px',
        'padding': '0px 2px',
        'z-index': '10'});

    $('<button>')
      .appendTo(this.Menu)
      .text('Snap Shot')
      .css({
        'margin': '2px 0px',
        'width': '100%'})
      .prop('title', 'Replace Annotation')
      .click(
        function () {
          self.SnapShotAnnotation(self.MenuAnnotationObject);
          self.Menu.hide();
        });
    $('<button>')
      .appendTo(this.Menu)
      .text('Delete')
      .css({
        'margin': '2px 0px',
        'width': '100%'})
      .click(
        function () {
          self.DeleteAnnotation(self.MenuAnnotationObject);
          self.Menu.hide();
        });
    $('<button>')
      .appendTo(this.Menu)
      .text('Properties')
      .css({
        'margin': '2px 0px',
        'width': '100%'})
      .click(
        function () {
          self.ShowAnnotationPropertiesDialog(self.MenuAnnotationObject);
          self.Menu.hide();
        });
  }

  // Create a new annotation item from the annotation layer.
  // Save it in the database.  Add the annotation as a dot in the GUI.
  GirderWidget.prototype.NewAnnotationItem = function (e) {
    var annot = {'elements': []};
    annot.elements = this.RecordAnnotation();

    // Hack to save sections meta data to girder items
    if (e.ctrlKey && window.girder) {
      if (confirm('Save section meta data?')) {
        var sections = [];
        for (var i = 0; i < annot.elements.length; ++i) {
          var rect = annot.elements[i];
          if (rect.type === 'rectangle') {
            var x0 = rect.center[0] - rect.width / 2.0;
            var y0 = rect.center[1] - rect.height / 2.0;
            var x1 = x0 + rect.width;
            var y1 = y0 + rect.height;
            sections.push({'bounds': [x0, y0, x1, y1]});
          }
        }
        girder.rest.restRequest({
          path: 'item/' + this.ImageItemId + '/metadata',
          method: 'PUT',
          contentType: 'application/json',
          data: JSON.stringify({'sections': sections})
        });
        return;
      }
    }

    annot.name = prompt('Name', 'Annotation');
    if (!annot.name) {
      return;
    }
    // Make a new annotation in the database.
    var self = this;
    if (window.girder) { // Conditional is for testing in slide atlas.
      girder.rest.restRequest({
        path: 'annotation?itemId=' + this.ImageItemId,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(annot)
      }).done(function (retAnnot) {
        // This has the girder id.
        self.Highlight(self.AddAnnotation(retAnnot));
      });
    } else {
      // for debugging without girder.
      self.Highlight(self.AddAnnotation(
        {_id: 'ABC',
          annotation: annot,
          itemId: self.ImageItemId}));
    }
  };

  GirderWidget.prototype.LoadGirderImageItem = function (itemId) {
        // var itemId = "564e42fe3f24e538e9a20eb9";
        // I think data is the wron place to pass these parameters.
    var data = {
      'limit': 50,
      'offset': 0,
      'sort': 'lowerName',
      'sortdir': 0};

    var self = this;
        // This gives an array of {_id:"....",annotation:{name:"...."},itemId:"...."}
    girder.rest.restRequest({
      path: 'annotation?itemId=' + itemId,
      method: 'GET',
      data: JSON.stringify(data)
    }).done(function (data) {
      for (var i = 0; i < data.length; ++i) {
        self.LoadAnnotationItem(data[i]._id);
      }
    });
  };

  GirderWidget.prototype.LoadAnnotationItem = function (annotId) {
    // var annotId = "572be29d3f24e53573aa8e91";
    var self = this;
    girder.rest.restRequest({
      path: 'annotation/' + annotId,
      method: 'GET',
      contentType: 'application/json'
    }).done(function (data) {
      self.AddAnnotation(data);
    });
  };

  // Converts annotation layer widgets into girder annotation elements.
  // returns an elements array.
  GirderWidget.prototype.RecordAnnotation = function () {
    var returnElements = [];
    var i;
    var j;
    var points;

    // record the view.
    /*
    var cam = this.AnnotationLayer.GetCamera();
    var element = {
      'type': 'view',
      'center': cam.GetFocalPoint(),
      'height': cam.GetHeight(),
      'width': cam.GetWidth(),
      'rotation': cam.Roll};
    element.center[2] = 0;
    returnElements.push(element);
    element = undefined;
    */
    var element;
    for (i = 0; i < this.AnnotationLayer.GetNumberOfWidgets(); ++i) {
      var widget = this.AnnotationLayer.GetWidget(i).Serialize();
      if (widget.type === 'circle') {
        widget.origin[2] = 0; // z coordinate
        element = {
          'type': 'circle',
          'center': widget.origin,
          'radius': widget.radius};
      }
      if (widget.type === 'text') {
        // Will not keep scale feature..
        points = [widget.position, widget.offset];
        points[1][0] += widget.position[0];
        points[1][1] += widget.position[1];
        points[0][2] = 0;
        points[1][2] = 0;
        element = {
          'type': 'arrow',
          'lineWidth': 10,
          'fillColor': SAM.ConvertColorToHex(widget.color),
          'points': points};
        element.label = {
          'value': widget.string,
          'fontSize': widget.size,
          'color': SAM.ConvertColorToHex(widget.color)};
      }
      if (widget.type === 'grid') {
        element = {
          'type': 'rectanglegrid',
          'center': widget.origin,
          'width': widget.bin_width * widget.dimensions[0],
          'height': widget.bin_height * widget.dimensions[1],
          'rotation': widget.orientation,
          'normal': [0, 0, 1.0],
          'widthSubdivisions': widget.dimensions[0],
          'heightSubdivisions': widget.dimensions[1]};
      }
      if (widget.type === 'rect') {
        element = {
          'type': 'rectangle',
          'label': {'value': 'test'},
          'center': widget.origin,
          'height': widget.height,
          'width': widget.width,
          'rotation': widget.orientation};
      }
      if (widget.type === 'rect_set') {
        var num = widget.widths.length;
        for (j = 0; j < num; ++j) {
          element = {
            'type': 'rectangle',
            'label': {'value': widget.labels[j]},
            'center': [widget.centers[2 * j], widget.centers[2 * j + 1], 0],
            'height': widget.heights[j],
            'width': widget.widths[j],
            'rotation': 0,
            'scalar': widget.confidences[j]};
          returnElements.push(element);
        }
        element = undefined;
      }
      if (widget.type === 'polyline') {
        // add the z coordinate
        for (j = 0; j < widget.points.length; ++j) {
          widget.points[j][2] = 0;
        }
        element = {
          'type': 'polyline',
          'closed': widget.closedloop,
          'points': widget.points};
      }
      if (widget.type === 'lasso') {
                // add the z coordinate
        for (j = 0; j < widget.points.length; ++j) {
          widget.points[j][2] = 0;
        }
        element = {
          'type': 'polyline',
          'closed': true,
          'points': widget.points};
      }
      // Pencil scheme not exact match.  Need to split up polylines.
      if (widget.type === 'pencil') {
        for (i = 0; i < widget.shapes.length; ++i) {
          points = widget.shapes[i];
          // Add the z coordinate.
          for (j = 0; j < points.length; ++j) {
            points[j][2] = 0;
          }
          element = {
            'type': 'polyline',
            'closed': false,
            'points': points};
          // Hackish way to deal with multiple lines.
          if (widget.outlinecolor) {
            element.lineColor = SAM.ConvertColorToHex(widget.outlinecolor);
          }
          if (widget.linewidth) {
            element.lineWidth = Math.round(widget.linewidth);
          }
          returnElements.push(element);
          element = undefined;
        }
      } else if (element) {
        if (widget.outlinecolor) {
          element.lineColor = SAM.ConvertColorToHex(widget.outlinecolor);
        }
        if (widget.linewidth) {
          element.lineWidth = Math.round(widget.linewidth);
        }
        returnElements.push(element);
        element = undefined;
      }
    }
    return returnElements;
  };

  GirderWidget.prototype.ShowAnnotationPropertiesDialog = function (annotObj) {
    this.Highlight(annotObj);
    annotObj.name = prompt('Name', annotObj.name);
    annotObj.Circle.text(annotObj.name);
    if (window.girder) {
      // Save in the database
      girder.rest.restRequest({
        path: 'annotation/' + annotObj.Data._id,
        method: 'PUT',
        data: JSON.stringify(annotObj.Data.annotation),
        contentType: 'application/json'
      });
    }
  };

  // Replace an existing annotation with the current state of the
  // annotation layer.  Saves in the database too.
  // NOTE: We have no safe way for the database save to fail.
  GirderWidget.prototype.SnapShotAnnotation = function (annotObj) {
    this.Highlight(annotObj);
    annotObj.Data.annotation.elements = this.RecordAnnotation();
    if (window.girder) {
      // Save in the database
      girder.rest.restRequest({
        path: 'annotation/' + annotObj.Data._id,
        method: 'PUT',
        data: JSON.stringify(annotObj.Data.annotation),
        contentType: 'application/json'
      });
    }
  };

  // Delete button in menu calls this.
  // Remove the annotation from the gui and database.
  // TODO: animate the circles moving up.
  GirderWidget.prototype.DeleteAnnotation = function (deleteAnnotObj) {
    var found = false;
    var newObjects = [];
    var y;
    for (var i = 0; i < this.AnnotationObjects.length; ++i) {
      var annotObj = this.AnnotationObjects[i];
      if (found) {
        // Animate the dots up to fill the space.
        y = 70 + ((i - 1) * 6 * this.Radius);
        annotObj.Circle.animate({'top': y + 'px'});
        newObjects.push(annotObj);
      } else if (deleteAnnotObj === annotObj) {
        found = true;
        annotObj.Circle.remove();
        if (window.girder) {
          // Remove the annotation from the database.
          girder.rest.restRequest({
            path: 'annotation/' + annotObj.Data._id,
            method: 'DELETE',
            contentType: 'application/json'
          });
        }
      } else {
        newObjects.push(annotObj);
      }
    }
    // Animate the "Add Annotation" button up too.
    y = 70 + ((i - 1) * 6 * this.Radius);
    this.Plus.animate({'top': y + 'px'});
    this.AnnotationObjects = newObjects;
  };

  // Animate the "add annotation" button down to make room for another
  // annotation button.  Make a new annotation and save it in the
  // database. Return the annotationObject which has GUI and data.
  GirderWidget.prototype.AddAnnotation = function (data) {
    var idx = this.AnnotationObjects.length;
    var y = 70 + (idx * 6 * this.Radius);

    var self = this;
    var circle = $('<div>')
      .appendTo(this.AnnotationLayer.GetCanvasDiv())
      .css({
        'position': 'absolute',
        'left': (3 * this.Radius) + 'px',
        'top': y + 'px',
        'min-width': (2 * this.Radius) + 'px',
        'min-height': (2 * this.Radius) + 'px',
        'background-color': '#55BBFF',
        'opacity': '0.6',
        'border': '1px solid #666666',
        'border-radius': this.Radius + 'px'})
      .prop('title', 'Show Annotation')
      .text(data.annotation.name)
      .hide() // hide until animation is finished.
      .hover(function () { $(this).css({'opacity': '1'}); },
             function () { $(this).css({'opacity': '0.6'}); });

    var annotObj = {
      Data: data,
      Circle: circle};
    this.AnnotationObjects.push(annotObj);

    circle.contextmenu(function () { return false; });
    circle.mousedown(function (e) {
      if (e.button === 0) {
        self.DisplayAnnotation(annotObj);
        return false;
      }
      if (e.button === 2) {
        self.MenuAnnotationObject = annotObj;
        // Position and show the properties menu.
        var pos = $(this).position();
        self.Menu
          .css({
            'left': (5 + pos.left + 2 * self.Radius) + 'px',
            'top': (pos.top) + 'px'})
          .show();
        return false;
      }
      return true;
    });

    // Annotate the "add annotation" button down.
    this.Plus.animate({'top': (y + (6 * this.Radius)) + 'px'}, 400,
                      function () { circle.show(); });

    return annotObj;
  };

  // Make the circle button yellow (and turn off the previous.)
  GirderWidget.prototype.Highlight = function (annotObj) {
    // Highlight the circle for this annotaiton.
    if (this.Highlighted) {
      this.Highlighted.Circle.css({'background-color': '#55BBFF'});
    }
    this.Highlighted = annotObj;
    if (annotObj) {
      annotObj.Circle.css({'background-color': '#FFDD00'});
    }
  };

  // Move the annotation info to the layer widgets and draw.
  GirderWidget.prototype.DisplayAnnotation = function (annotObj) {
    this.AnnotationLayer.SetVisibility(true);
    this.Highlight(annotObj);

    this.AnnotationLayer.Reset();

    // Put all the rectangles into one set.
    var setObj = {};
    setObj.type = 'rect_set';
    setObj.centers = [];
    setObj.widths = [];
    setObj.heights = [];
    setObj.confidences = [];
    setObj.labels = [];

    var annot = annotObj.Data.annotation;
    for (var i = 0; i < annot.elements.length; ++i) {
      var element = annot.elements[i];
      var obj = {};

      if (element.type === 'view') {
                // Set the camera / view.
        var cam = this.AnnotationLayer.GetCamera();
        cam.SetFocalPoint(element.center);
        cam.SetHeight(element.height);
        if (element.rotation) {
          cam.Roll = element.rotation;
        } else {
          cam.Roll = 0;
        }
        // Ignore width for now because it is determined by the
        // viewport.
        cam.ComputeMatrix();
        // How to handle forcing viewer to render?
        // I could have a callback.
        // I could also make a $('.sa-viewer').EventuallyRender();
        // or $('.sa-viewer').saViewer('EventuallyRender');
        if (this.AnnotationLayer.Viewer) {
          this.AnnotationLayer.Viewer.EventuallyRender();
        }
      }
      if (element.type === 'circle') {
        obj.type = element.type;
        obj.outlinecolor = SAM.ConvertColor(element.lineColor);
        obj.linewidth = element.lineWidth;
        obj.origin = element.center;
        obj.radius = element.radius;
        this.AnnotationLayer.LoadWidget(obj);
      }
      if (element.type === 'arrow') {
        obj.type = 'text';
        obj.string = element.label.value;
        obj.color = SAM.ConvertColor(element.fillColor);
        obj.size = element.label.fontSize;
        obj.position = element.points[0].slice(0);
        obj.offset = element.points[1].slice(0);
        obj.offset[0] -= obj.position[0];
        obj.offset[1] -= obj.position[1];
        this.AnnotationLayer.LoadWidget(obj);
      }
      if (element.type === 'rectanglegrid') {
        obj.type = 'grid';
        obj.outlinecolor = SAM.ConvertColor(element.lineColor);
        obj.linewidth = element.lineWidth;
        obj.origin = element.center;
        obj.bin_width = element.width / element.widthSubdivisions;
        obj.bin_height = element.height / element.heightSubdivisions;
        obj.orientation = element.rotation;
        obj.dimensions = [element.widthSubdivisions, element.heightSubdivisions];
        this.AnnotationLayer.LoadWidget(obj);
      }
      if (element.type === 'rectangle') {
        if (element.type === 'rectangle') { // switch behavior to ....
          setObj.widths.push(element.width);
          setObj.heights.push(element.height);
          setObj.centers.push(element.center[0]);
          setObj.centers.push(element.center[1]);
          if (element.scalar === undefined) {
            element.scalar = 1.0;
          }
          setObj.confidences.push(element.scalar);
          if (element.label) {
            setObj.labels.push(element.label.value);
          } else {
            setObj.labels.push('');
          }
        } else {
          obj.type = 'rect';
          obj.outlinecolor = SAM.ConvertColor(element.lineColor);
          obj.linewidth = element.lineWidth;
          obj.origin = element.center;
          obj.width = element.width;
          obj.length = element.height;
          obj.orientation = element.rotation;
          this.AnnotationLayer.LoadWidget(obj);
        }
      }
      if (element.type === 'polyline') {
        obj.type = element.type;
        obj.closedloop = element.closed;
        obj.outlinecolor = SAM.ConvertColor(element.lineColor);
        obj.linewidth = element.lineWidth;
        obj.points = element.points;
        this.AnnotationLayer.LoadWidget(obj);
      }
    }

    if (setObj.widths.length > 0) {
      this.AnnotationLayer.LoadWidget(setObj);
    }

    this.AnnotationLayer.EventuallyDraw();
  };

  SAM.GirderWidget = GirderWidget;
})();
