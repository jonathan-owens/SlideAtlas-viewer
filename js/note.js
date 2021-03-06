// ------------------------------------------------------------------------------
// Note object (maybe will be used for views and sessions too).

// TODO: Remove GUI from this file.

(function () {
  'use strict';

  // Note load states.
  var INVALID = 0; // just an id
  var REQUESTED = 1;    // Load request and waiting for the callback
  var SYNCHRONIZED = 2; // Same as database

  // Globals
  // The client creates the real and permanent id, so this works even if
  // the note has not been added to the database.
  SA.GetNoteFromId = function (id) {
    for (var i = 0; i < SA.Notes.length; ++i) {
      var note = SA.Notes[i];
      if (note.Id && note.Id === id) {
        return note;
      }
    }
    return null;
  };
  SA.GetUserNoteFromImageId = function (id) {
    for (var i = 0; i < SA.Notes.length; ++i) {
      var note = SA.Notes[i];
      if (note.Type === 'UserNote' && note.Parent === id) {
        return note;
      }
    }
    return null;
  };
    // When a note fails to load, we need to remove it from the global list
    // of notes. We also delete recorder notes.  Once saved, we never user
    // them again.
  SA.DeleteNote = function (note) {
    var idx = SA.Notes.indexOf(note);
    if (idx !== -1) {
      SA.Notes.splice(idx, 1);
    }
  };

  function Note () {
    if (!SA.Notes) {
            // data is the object retrieved from mongo (with string ids)
            // Right now we expect bookmarks, but it will be generalized later.
      SA.Notes = [];
    }

        // A global list of notes so we can find a note by its id.
        // TODO: Legacy.  Get rid of TempId.
    this.Id = this.TempId = new ObjectId().toString();
    SA.Notes.push(this);

    var self = this;
        // 0: just an id
        // 1: requested
        // 2: received
    this.LoadState = INVALID;

    this.User = SA.GetUser(); // Reset by flask.
    var d = new Date();
    this.Date = d.getTime(); // Also reset later.
    this.Type = 'Note';
    this.Mode = '';

    this.Title = '';
    this.Text = '';
    this.Modified = false;

        // Upto two for dual view.
    this.ViewerRecords = [];

        // ParentNote (it would be nice to make the session a note too).
    this.Parent = null;

        // Sub notes
    this.Children = [];
    this.ChildrenVisibility = true;

        // GUI elements.
    this.Div = $('<li>')
            .attr({'class': 'note'});

    this.TitleDiv = $('<div>')
            .css({'position': 'relative'})
            .appendTo(this.Div);

    this.SortHandle = $('<span>')
            .appendTo(this.TitleDiv)
            .css({'position': 'absolute',
              'left': '0px',
              'top': '0px',
              'opacity': '0.5'})
            .addClass('ui-icon ui-icon-bullet');

    this.ButtonsDiv = $('<div>')
            .appendTo(this.TitleDiv)
            .css({'float': 'right'})
            .hide();
    this.TitleEntry = $('<div>')
            .css({'margin-left': '20px'})
            .appendTo(this.TitleDiv)
            .text(this.Title)
            .addClass('sa-title');
    if (this.Mode === 'answer-hide' || this.Mode === 'answer-interactive') {
      this.TitleEntry.text('-');
    }

    if (SA.Edit) {
      this.AddButton = $('<img>')
                .appendTo(this.ButtonsDiv)
                .attr('src', SA.ImagePathUrl + 'page_add.png')
                .addClass('editButton')
                .prop('title', 'add view')
                .css({
                  'width': '12px',
                  'height': '12px',
                  'opacity': '0.5'});
      this.LinkButton = $('<img>')
                .appendTo(this.ButtonsDiv)
                .attr('src', SA.ImagePathUrl + 'link.png')
                .prop('title', 'show url')
                .addClass('editButton')
                .css({
                  'width': '12px',
                  'height': '12px',
                  'opacity': '1.0'});
      this.RemoveButton = $('<img>')
                .appendTo(this.ButtonsDiv)
                .hide()
                .attr('src', SA.ImagePathUrl + 'remove.png')
                .prop('title', 'delete')
                .addClass('editButton')
                .css({
                  'width': '12px',
                  'height': '12px',
                  'opacity': '0.5'});
    }

    if (SA.HideAnnotations || this.Mode === 'answer-hide' ||
            this.Mode === 'answer-interactive') {
      this.TitleEntry.text('-');
    }

    if (SA.Edit) {
      this.Modified = false;
      if (this.Mode === 'answer-hide' && this.Mode !== 'answer-interactive') {
        this.TitleEntry
                    .attr('contenteditable', 'true');
      }
    }

        // The div should attached even if nothing is in it.
        // A child may appear and UpdateChildrenGui called.
        // If we could tell is was removed, UpdateChildGUI could append it.
    this.ChildrenDiv = $('<ul>')
            .addClass('sa-ul')
            .appendTo(this.Div);

    if (SA.Edit) {
      this.ChildrenDiv
                .sortable({update: function (event, ui) { self.SortCallback(); },
                  handle: '.ui-icon'});
    } else {
      this.ChildrenDiv
                .disableSelection();
    }

        // This is for stack notes (which could be a subclass).
        // It looks like the stack will start on this index when it first
        // is loaded.  This changes when navigating the stack.
    this.StartIndex = 0;
    this.ActiveCorrelation = undefined;
    this.StackDivs = [];
  }

    // For copy slide in presentations
  Note.prototype.DeepCopy = function (note) {
        // I tried serialize / load, but the image changed to a string id.
    this.Image = Note.Image; // not really deep.
    this.Children = [];
    for (var i = 0; i < note.Children.length; ++i) {
      var child = new SA.Note();
      child.DeepCopy(note.Children[i]);
      this.Children.push(child);
    }
    this.Parent = note.Parent;
    this.StartIndex = note.StartIndex;
        // Replace old note id with new in HTML.
    var oldId = note.Id;
    var newId = this.Id;
    this.Text = note.Text.replace(oldId, newId);
    this.Title = note.Title;
    this.Type = note.Type;
    this.User = note.User;
        // this.UserText = note.UserText;
    this.ViewerRecords = [];
    for (i = 0; i < note.ViewerRecords.length; ++i) {
      var record = new SA.ViewerRecord();
      record.DeepCopy(note.ViewerRecords[i]);
      this.ViewerRecords.push(record);
    }
  };

    // So this is a real pain.  I need to get the order of the notes from
    // the childrenDiv jquery element.
  Note.prototype.SortCallback = function () {
    var newChildren = [];
    var children = this.ChildrenDiv.children();
    for (var newIndex = 0; newIndex < children.length; ++newIndex) {
      var oldIndex = $(children[newIndex]).data('index');
      var note = this.Children[oldIndex];
      note.Div.data('index', newIndex);
      newChildren.push(note);
    }

    this.Children = newChildren;
    this.UpdateChildrenGUI();
    if (SA.notesWidget) {
      SA.notesWidget.MarkAsModified();
    }
  };

  // When the note is deleted, this clear associated text links.
  // However, it does not remove the span id.
  Note.prototype.ClearHyperlink = function () {
    if (this.Id) {
      // I think is will be best to seelct the element and then replace
      // it with text.
      this.SelectHyperlink();
      var sel = window.getSelection();
      document.execCommand('insertText', sel.toString());
    }
  };

  // Pragmatically select the hyper link (when the note is selected).
  Note.prototype.SelectHyperlink = function () {
    if (this.Id) {
      var el = document.getElementById(this.Id);
      if (el) {
        var range = document.createRange();
                // range.selectNodeContents(el);
        range.selectNode(el);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  };

  // Pragmatically select the hyper link (when the note is selected).
  Note.prototype.UnselectHyperlink = function () {
    if (this.Id) {
      var el = document.getElementById(this.Id);
      if (el) {
        var range = document.createRange();
        range.collapse(true);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  };

  Note.prototype.SetParent = function (parent) {
    this.Parent = parent;
    if (parent && SA.Edit) {
      this.RemoveButton.show();
    }
  };

  Note.prototype.TitleFocusInCallback = function () {
        // Keep the viewer from processing arrow keys.
    SA.ContentEditableHasFocus = true;
    SA.SetNote(this);
  };

  Note.prototype.TitleFocusOutCallback = function () {
    if (this.Modified) {
            // Move the Title from the GUI to the note.
      this.Modified = false;
      if (this.Mode !== 'answer-hide' && this.Mode !== 'answer-interactive') {
        this.Title = this.TitleEntry.text();
      }
      if (SA.notesWidget) {
        SA.notesWidget.MarkAsModified();
      }
    }
        // Allow the viewer to process arrow keys.
    SA.ContentEditableHasFocus = false;
    if (!this.Modified) { return; }
    this.Modified = false;
    if (this.Mode !== 'answer-hide' && this.Mode !== 'answer-interactive') {
      var text = this.TitleEntry.text();
      if (this.Title !== text && !SA.HideAnnotations) {
        this.Title = text;
        this.Save();
      }
    }
  };

  Note.prototype.LinkCallback = function () {
    if (!SA.LinkDiv) { return; }
    var text = 'slide-atlas.org/webgl-viewer?view=' + this.Id;
    SA.LinkDiv.html(text);
    SA.LinkDiv.show();
        // Select the text so it is easy to copy.
    var range = document.createRange();
    range.selectNodeContents(SA.LinkDiv[0]);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

        // Try to copy to the clipboard.
    document.execCommand('copy', false, null);
  };

  Note.prototype.DeleteCallback = function () {
    if (this.Type === 'UserNote') {
            // User notes have a parent, but are also roots.
      return;
    }
    var parent = this.Parent;
    if (parent === null) {
      return;
    }

    this.ClearHyperlink();

    if (this.Type !== 'view') {
      if (SA.display && SA.display.NavigationWidget &&
                SA.display.NavigationWidget.GetNote() === this) {
                // Move the current note off this note.
                // There is always a previous.
        SA.display.NavigationWidget.PreviousNote();
      }
    }

        // Get rid of the note.
    var index = parent.Children.indexOf(this);
    parent.Children.splice(index, 1);
    this.Parent = null;

        // Redraw the GUI.
    parent.UpdateChildrenGUI();
    if (SA.notesWidget) {
      SA.notesWidget.MarkAsModified();
    }
  };

    // User notes are associated with images. They should be referenced by
    // the viewer record.  THis method is only used by presentations.
    // TODO: Fix this.
  Note.prototype.SetUserNote = function (userNote) {
    var parentNote = this;
    parentNote.UserNote = userNote;
    userNote.Parent = parentNote;
    userNote.Type = 'UserNote';
  };

  Note.prototype.UserCanEdit = function () {
    return SA.Edit;
  };

  Note.prototype.RecordView = function (display) {
        // TODO: Get rid of VIEWER globals.
    if (display.GetNumberOfViewers() === 0) { return; }

    if (this.Type === 'Stack') {
            // All we want to do is record the default
            // camera of the first section (if we at
            // the start of the stack).
      var viewer0 = display.GetViewer(0);
      if (this.StartIndex === 0) {
        this.ViewerRecords[0].CopyViewer(viewer0);
      }
      return;
    }
    this.ViewerRecords = [];
    for (var i = 0; i < display.GetNumberOfViewers(); ++i) {
      var viewerRecord = new SA.ViewerRecord();
      viewerRecord.CopyViewer(display.GetViewer(i));
      this.ViewerRecords.push(viewerRecord);
    }
  };

  Note.prototype.AddChild = function (childNote, first) {
        // Needed to get the order after a sort.
    childNote.Div.data('index', this.Children.length);

    if (first) {
      this.Children.splice(0, 0, childNote);
    } else {
      this.Children.push(childNote);
    }

    this.UpdateChildrenGUI();
  };

  // TODO: Get the GUI stuff out of note objects.
  Note.prototype.UpdateChildrenGUI = function () {
    // Callback trick
    var i;

    // Clear
    this.ChildrenDiv.empty();

    // Stacks
    if (this.Type === 'Stack') {
      // I want viewer records to look like children for stacks.
      this.StackDivs = [];
      for (i = 0; i < this.ViewerRecords.length; ++i) {
        var sectionDiv = $('<div>')
                    .addClass('note')
                    .appendTo(this.ChildrenDiv);
        if (SA.HideAnnotations) {
          sectionDiv.text(i.toString());
        } else {
          sectionDiv.text(this.ViewerRecords[i].Image.label);
        }
        this.StackDivs.push(sectionDiv);
        if (i === this.StartIndex) {
          sectionDiv.css({'background-color': '#BBB'});
        }
      }
      return;
    }

    // Notes
    if (this.Children.length === 0) {
      return;
    }

    // Move all the views to the end.  They do not take part in the notes
    // gui. They are for text links.  They may mess up drag ordering.
    var newChildren = [];
    for (i = 0; i < this.Children.length; ++i) {
      if (this.Children[i].Type === 'Note') {
        newChildren.push(this.Children[i]);
      }
    }
    for (i = 0; i < this.Children.length; ++i) {
      if (this.Children[i].Type !== 'Note') {
        newChildren.push(this.Children[i]);
      }
    }
    this.Children = newChildren;

    for (i = 0; i < this.Children.length; ++i) {
      if (this.Children[i].Type === 'Note') {
        this.Children[i].DisplayGUI(this.ChildrenDiv);
        // Indexes used for sorting.
        this.Children[i].Div.data('index', i);
        if (this.Children.length > 1) {
          this.Children[i].SortHandle.addClass('sa-sort-handle');
        } else {
          this.Children[i].SortHandle.removeClass('sa-sort-handle');
        }
      }
    }
  };

  Note.prototype.NewIterator = function () {
    return new SA.NoteIterator(this);
  };

  Note.prototype.Contains = function (decendent) {
    for (var i = 0; i < this.Children.length; ++i) {
      var child = this.Children[i];
      if (child === decendent) {
        return true;
      }
      if (child.Contains(decendent)) {
        return true;
      }
    }
    return false;
  };

    // Create a new note,  add it to the parent notes children at index "childIdx".
    // The new note is not automatically selected.
  Note.prototype.NewChild = function (childIdx, title) {
        // Create a new note.
    var childNote = new SA.Note();
    childNote.Title = title;
    var d = new Date();
    childNote.Date = d.getTime(); // Temporary. Set for real by server.

        // Now insert the child after the current note.
    this.Children.splice(childIdx, 0, childNote);
    childNote.SetParent(this);

    return childNote;
  };

    // Save the note in the database and set the note's id if it is new.
    // callback function can be set to execute an action with the new id.
  Note.prototype.Save = function (callback, excludeChildren) {
    console.log('Save note ' + this.Id + ' ' + this.Title);

    var self = this;
        // Save this users notes in the user specific collection.
    var noteObj = JSON.stringify(this.Serialize(excludeChildren));
    var d = new Date();
    SA.PushProgress();
    $.ajax({
      type: 'post',
      url: '/webgl-viewer/saveviewnotes',
      data: {'note': noteObj,
        'date': d.getTime()},
      success: function (data, status) {
        SA.PopProgress();
        if (callback) {
          (callback)(self);
        }
        self.LoadState = SYNCHRONIZED;
      },
      error: function () {
        SA.PopProgress();
        SA.Debug('AJAX - error() : saveviewnotes');
      }
    });
  };

  Note.prototype.HasAnnotations = function () {
    for (var i = 0; i < this.ViewerRecords.length; ++i) {
      if (this.ViewerRecords.Annotations.length > 0) {
        return true;
      }
    }
    return false;
  };

    // TODO: Method only used by presentations.  Move this to viewer
    // record.
    // This takes the state of the GUI and updates the notes to match
  Note.prototype.RecordAnnotations = function (display) {
        // This is ok, because user notes do not have user notes of their own.
    if (this.UserNote) {
            // UserNote annotations are kept separate from other annotations.
      this.UserNote.RecordAnnotations(display);
            // Save it to the database aggresively.
            // If the note has annotations, they might be new.
            // If it was loaded, the annotations might have been deleted.
      if (this.UserNote.HasAnnotations() ||
                this.UserNote.LoadState !== INVALID) {
        this.UserNote.Save();
      }
    }

        // A bit confusing.  This executes for both normal notes and user
        // notes. Each saves a different subset of the annotations.
    for (var i = 0; i < display.GetNumberOfViewers(); ++i) {
      if (this.ViewerRecords.length > this.StartIndex + i) {
        var viewerRecord = this.ViewerRecords[this.StartIndex + i];
        viewerRecord.CopyAnnotations(
                    display.GetViewer(i), (this.Type === 'UserNote'));
      }
    }
  };

    // No clearing.  Just draw this notes GUI in a div.
  Note.prototype.DisplayGUI = function (div) {
    var self = this;
    this.Div.appendTo(div);

    if (this.Mode !== 'answer-hide' && this.Mode !== 'answer-interactive') {
      this.TitleEntry
                .click(function () {
                  SA.SetNote(self);
                  self.ButtonsDiv.show();
                })
                .bind('input', function () {
                  self.Modified = true;
                })
                .focusin(function () { self.TitleFocusInCallback(); })
                .focusout(function () { self.TitleFocusOutCallback(); })
                .mouseleave(function () {
                  if (self.Modified) {
                    self.Modified = false;
                    self.Title = self.TitleEntry.text();
                    if (SA.notesWidget) { SA.notesWidget.MarkAsModified(); }
                  }
                });
      this.TitleDiv
                .hover(
                    function () {
                      self.TitleEntry.css({'color': '#33D'});
                      if (SA.notesWidget && SA.notesWidget.SelectedNote === self) {
                        self.ButtonsDiv.show();
                      }
                    },
                    function () {
                      self.TitleEntry.css({'color': '#3AF'});
                      self.ButtonsDiv.hide();
                    });
      this.TitleEntry.text(this.Title);
    } else {
      this.TitleEntry.text('-');
    }

        // Changing a div "parent/appendTo" removes all event bindings like click.
        // I would like to find a better solution to redraw.
    if (SA.Edit) {
            // Removing and adding removes the callbacks.
      this.AddButton
                .click(function () {
                  if (SA.notesWidget) { SA.notesWidget.NewCallback(); }
                });
      this.LinkButton
                .click(function () {
                  self.LinkCallback();
                });
      this.RemoveButton
                .click(function () {
                  self.DeleteCallback();
                });
    }

    this.UpdateChildrenGUI();
  };

  Note.prototype.Serialize = function (excludeChildren) {
    var obj = {};
    obj.SessionId = localStorage.sessionId;
    obj.Type = this.Type;
    obj.Mode = this.Mode;
    obj.User = this.User;
    obj.Date = this.Date;
    if (this.WaterMark) {
      obj.WaterMark = this.WaterMark;
    }

    // user data to customize note types
    // I needed this for background color and apsect ratio of presentations.
    if (this.TypeData) {
      obj.TypeData = this.TypeData;
    }

    if (this.NotesPanelOpen) {
      obj.NotesPanelOpen = true;
    }

    if (this.Id) {
      obj._id = this.Id;
      delete this._id;
    }
    // I would like to put the session as parent, but this would be an inclomplete reference.
    // A space is not a valid id. Niether is 'false'. Lets leave it blank.
    if (this.Parent) {
      if (typeof (this.Parent) === 'string') {
        // When the parent is an image.
        obj.ParentId = this.Parent;
      }
      if (typeof (this.Parent) === 'object' && this.Parent.Id) {
        // When the parent is a note.
        obj.ParentId = this.Parent.Id;
      }
      // These snuck into the database.
      delete this.ParentId;
    }
    obj.Title = this.Title;
    obj.HiddenTitle = this.HiddenTitle;

    obj.Text = this.Text;
    // The server handles copying views and the code is a pain.
    // I would rather have the client copy notes since is can now
    // save them one by one and get ids for new notes.
    // However,  until I make this change, I need a simple way of copying
    // a note and not messing up the references in the text.
    // Code the links in the html as indexes.
    // for (var i = 0; i < this.Children.length; ++i) {
    //    var Child
    // }

    // We should probably serialize the ViewerRecords too.
    obj.ViewerRecords = [];

    // The database wants an image id, not an embedded iamge object.
    //  The server should really take care of this since if
    for (var i = 0; i < this.ViewerRecords.length; ++i) {
      if (!this.ViewerRecords[i].Image) continue;
      var record = this.ViewerRecords[i].Serialize();
      obj.ViewerRecords.push(record);
    }

    // upper left pixel
    obj.CoordinateSystem = 'Pixel';

    // Will this erase children if includeChildren is off?
    if (!excludeChildren) {
      obj.Children = [];
      for (i = 0; i < this.Children.length; ++i) {
        obj.Children.push(this.Children[i].Serialize(excludeChildren));
      }
    }

    return obj;
  };

  // This method of loading is causing a pain.
  // Children are saved separately now, so the pain should be gone.
  Note.prototype.Load = function (obj) {
    // Received
    this.LoadState = SYNCHRONIZED;

    var ivar;
    for (ivar in obj) {
      this[ivar] = obj[ivar];
    }
    // I am not sure blindly copying all of the variables is a good idea.
    if (this._id) {
      this.Id = this._id;
      delete this._id;
    }

    // It would be better not to set the ParentId of user notes in the
    // first place. userNote.Parent is set to the id of the image.
    if (this.Type !== 'UserNote' && this.ParentId) {
      this.Parent = SA.GetNoteFromId(this.ParentId);
      delete this.ParentId;
    }

    if (SA.HideAnnotations || this.Mode === 'answer-hide' ||
            this.Model === 'answer-interactive') {
      this.TitleEntry.text('-');
    } else {
      this.TitleEntry.text(this.Title);
    }

    for (var i = 0; i < this.Children.length; ++i) {
      var child = this.Children[i];
      var childNote = new SA.Note();
      childNote.SetParent(this);
      if (typeof (child) === 'string') {
        // Asynchronous.  This may cause problems (race condition)
        // We should have a load state in note.
        // childNote.LoadViewId(child);
        childNote.Id = child;
      } else {
        childNote.Load(child);
      }
      this.Children[i] = childNote;
      childNote.Div.data('index', i);
    }

    // Only used by presentations.
    if (this.UserNote) {
      // Make the user not into a real object.
      obj = this.UserNote;
      this.UserNote = new SA.Note();
      this.UserNote.Load(obj);
    }

    for (i = 0; i < this.ViewerRecords.length; ++i) {
      if (this.ViewerRecords[i]) {
        obj = this.ViewerRecords[i];
        // It would be nice to have a constructor that took an object.
        this.ViewerRecords[i] = new SA.ViewerRecord();
        this.ViewerRecords[i].Load(obj);
        if (i < 3) {
          // Delay requesting the user notes for a long stack.
          this.ViewerRecords[i].RequestUserNote();
        }
      }
    }
  };

  // Making this handle callbacks added after original load call.
  // Will not reload. I am not really sure this feature is actually
  // needed. I will keep it to be safe.
  var HACK_LOAD_CALLBACKS = [];
  Note.prototype.LoadViewId = function (viewId, callback) {
    if (this.LoadState === SYNCHRONIZED) {
      // no realoading (could be done with an extra arg).
      (callback)();
      return;
    }
    if (this.LoadState === REQUESTED) {
      // Waiting for an ajax call to return.
      // Add the new callback to any already pending.
      // HACK + LOAD_CALLBACKS.push({note: this, callback: callback});
      return;
    }

    var self = this;
    this.LoadState = REQUESTED;

    SA.PushProgress();

    $.ajax({
      type: 'get',
      url: '/webgl-viewer/getview',
      data: {'viewid': viewId},
      success: function (data, status) {
        SA.PopProgress();
        self.Load(data);
        if (callback) {
          (callback)();
        }
        // Look for anycallbacks added after the ajax call.
        // This feature may nt be used, but it is safe.
        // I have been having problems with views note display in
        // presentations.
        var tmp = [];
        for (var i = 0; i < HACK_LOAD_CALLBACKS.length; ++i) {
          var tmp2 = HACK_LOAD_CALLBACKS[i];
          if (tmp2.note === self) {
            (tmp2.callback)();
          } else {
            tmp.push(tmp2);
          }
        }
        HACK_LOAD_CALLBACKS = tmp;
      },
      error: function () {
        SA.PopProgress();
        SA.Debug('AJAX - error() : getview');
      }
    });
  };

  Note.prototype.Collapse = function () {
    this.ChildrenVisibility = false;
    if (this.Contains(SA.notesWidget.SelectedNote)) {
      // Selected note should not be in collapsed branch.
      // Make the visible ancestor active.
      SA.SetNote(this);
    }
    this.UpdateChildrenGUI();
    SA.display.NavigationWidget.Update();
  };

  Note.prototype.Expand = function () {
    this.ChildrenVisibility = true;
    this.UpdateChildrenGUI();
    SA.display.NavigationWidget.Update();
  };

  // Extra stuff for stack.
  Note.prototype.DisplayStack = function (display) {
    // SA.SetNote(this);
    // For editing correlations
    if (SA.Edit && this.StartIndex + 1 < this.ViewerRecords.length) {
      var trans = this.ViewerRecords[this.StartIndex + 1].Transform;
      if (trans) {
        display.GetViewer(0).StackCorrelations = trans.Correlations;
        display.GetViewer(1).StackCorrelations = trans.Correlations;
      }
    }
    // Indicate which section is being displayed in viewer 1
    for (var i = 0; i < this.StackDivs.length; ++i) {
      if (i === this.StartIndex) {
        this.StackDivs[i].css({'background-color': '#BBB'});
      } else {
        this.StackDivs[i].css({'background-color': '#FFF'});
      }
    }
  };

  // Creates default transforms for Viewer Records 1-n
  // (if they do not exist already).  Uses cameras focal point.
  Note.prototype.InitializeStackTransforms = function () {
    for (var i = 1; i < this.ViewerRecords.length; ++i) {
      if (!this.ViewerRecords[i].Transform) {
        var cam0 = this.ViewerRecords[i - 1].Camera;
        var cam1 = this.ViewerRecords[i].Camera;
        var dRoll = cam1.Roll - cam0.Roll;
        if (dRoll < 0.0) { dRoll += 2 * Math.PI; }
        var trans = new SA.PairTransformation();
        trans.AddCorrelation(cam0.FocalPoint, cam1.FocalPoint, dRoll,
                                     0.5 * (cam0.Height + cam1.Height));
        this.ViewerRecords[i].Transform = trans;
      }
    }
  };

  SA.Note = Note;
})();
