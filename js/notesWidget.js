// A potential problem with user notes.  User note is created when a note
// is loaded.  It will not be possible to add user text right after a note
// is created.  I should disable usernote tab in this case. I do not think
// it is worthwile to create a user not earlier because I would have to
// merge user notes or indicate that a note is new and will never be loaded.
// that possibly share a superclass.

// Notes can be nested (tree structure) to allow for student questions, comments or discussion.
// Sessions could be notes.
// Notes within the same level are ordered.
// Question answers can be sub notes.

// Students can save comments that are not seen by other students.
// Student notes are stored as "favorites".
// Notes keep an ID of their parent in the database.
// The recording API is used to save the state of viewers (ViewerRecord)
// Notes just add a tree structure on top of these states (with GUI).

// Right now we are loading the view and bookmarks as notes.
// Bookmarks have two notes: Question and a child answer.
// I need to change this to be more like the origin open layers presentation.

// TODO:
// Highlight icon on hover.
// Drag notes to change the order.
// Show the user "favorite" notes.
// Allow user to delete the favorite note (even if edit is not on).

// HTML:
// Students like the HTML Text and would like to see hyperlinks to
// annotation and cameras.  The Scheme is not setup for this because
// children have their own text.  I am going to change the behavior so
// that children that do not have their own text, show the text of their
// parent.  I will probably hide children without text in the top display.
// TODO:
// Bug: Tabs do not look right (bottom should be white / z_index?)
// Bug: only the last child added can be selected by the title.
//      only the last child added shows the delete and camera buttons.
//      This only happens when editing.  Loading a saved view/note works
//      fine.
// Bug: Note title not being saved.
// Bug: Type "test" reload (not saved).

// Deleting a note should delete the usernote.
// Deleting a hyper link should delete its note. (test)

// Maybe have a "Add" at the bottom of the link list.
// Move deleted links to trash instead of deleting. (Undo delete)
// A way to get permalink to notes. (for Brown) (LinkCallback)
// Indicate the current note in the text.
// Save notes panel state (opened, closed, width) in mongo.
// ??? Link notes better in html ??? Saving edited html is the problem here.
// Make browser back arrow undo link (will this cause tiles to reload (note
//     panel to disapear?)

// NOTE:
// - !!!!!!!!!!!!!!!!!!!!!! Copy note needs to change ids in html !!!!!!!!!!!!!!!
// -I Could not highlight hyperlink when note is selected.
//     Text cannot be selected when hidden.  I would have to select the
//     text when Text tabe is clicked.....
// -Hyperlink selection background color (and color) should not be saved in
//     the note / database.

// ==============================================================================

(function () {
  'use strict';

    // TODO: put this class in its own file.
    // Links that open a separate window use this.
    // It has a gui to choose the window location and will reposition other
    // windows so they do not overlap.  Modeling after MS Windows snap
    // assist.

  function WindowManager () {
    var self = this;

    this.Windows = new Array(3);
    this.Windows[0] = new Array(3);
    this.Windows[1] = new Array(3);
    this.Windows[2] = new Array(3);

        // A model of the screen
    this.ScreenRectangle = $('<div>')
            .appendTo('body')
            .css({'position': 'absolute',
              'background': '#06F',
              'opacity': '0.5',
              'z-index': '100'})
            .hide();
        // hack to get dotted lines
    this.HorizontalLine = $('<div>')
            .appendTo(this.ScreenRectangle)
            .css({'position': 'absolute',
              'left': '0px',
              'width': '100%',
              'top': '50%',
              'height': '1px',
              'background': '#FFF',
              'opacity': '0.4'});
    this.VerticalLine = $('<div>')
            .appendTo(this.ScreenRectangle)
            .css({'position': 'absolute',
              'top': '0px',
              'height': '100%',
              'left': '50%',
              'width': '1px',
              'background': '#FFF',
              'opacity': '0.4'});
        // Feedback of where the window will be created
    this.WindowRectangle = $('<div>')
            .appendTo(this.ScreenRectangle)
            .css({'position': 'absolute',
              'box-sizing': 'border-box',
              'background': '#AAA',
              'border': '1px solid #FFF',
              'opacity': '0.7'});

        // Hiding does not get rid of the bound events.
    this.ScreenRectangle
            .bind('mousemove',
                  function (e) { self.HandleMouseMove(e); });
    this.ScreenRectangle
            .bind('mouseup',
                  function (e) { self.HandleMouseUp(e); });
    this.ScreenRectangle
            .bind('mouseleave',
                  function (e) { self.HandleMouseLeave(e); });

    $(window).bind('beforeunload', function () {
      for (var x = 0; x < 3; ++x) {
        for (var y = 0; y < 3; ++y) {
          var w = self.Windows[x][y];
          if (w && !w.closed) {
            w.close();
          }
        }
      }
    });
  }

    // mX,my is the mouse location.  The center of the GUI object will be
    // placed there.
  WindowManager.prototype.Show = function (mx, my, url, title) {
    this.Title = title || 'SlideAtlas';
    this.Url = url;

    this.AvailableLeft = screen.availLeft || 0;
    this.AvailableTop = screen.availTop || 0;
    this.AvailableWidth = screen.availWidth || screen.width || 1000;
    this.AvailableHeight = screen.availHeight || screen.height || 800;

    var w = this.AvailableWidth / 10;
    var h = this.AvailableHeight / 10;
    var x = mx - (w / 2);
    var y = my - (h / 2);
    if (x < 0) { x = 0; }
    if (y < 0) { y = 0; }

    this.Partition = [1, 1];
    this.WindowRectangle
            .css({'left': '3%',
              'top': '3%',
              'width': '94%',
              'height': '94%'});

    this.ScreenRectangle
            .css({'left': x + 'px',
              'top': y + 'px',
              'width': w + 'px',
              'height': h + 'px'})
            .show();
  };

  WindowManager.prototype.HandleMouseLeave = function (event) {
    this.ScreenRectangle.hide();
  };

  WindowManager.prototype.HandleMouseUp = function (event) {
    var xIdx = this.Partition[0];
    var yIdx = this.Partition[1];
    var w = this.Windows[xIdx][yIdx];
    if (w && !w.closed) {
      w.location.href = this.Url;
            // change the title
      w.document.title = this.Title;
      return;
    }

    var x = this.AvailableLeft;
    var y = this.AvailableTop;
    w = this.AvailableWidth;
    var h = this.AvailableHeight;

    if (xIdx !== 1) {
      w = w / 2;
    }
    if (yIdx !== 1) {
      h = h / 2;
    }
    if (xIdx === 2) {
      x = x + w;
    }
    if (yIdx === 2) {
      y = y + h;
    }
        // inner vs outer?
    w = w - 27;
    h = h - 100;
        // Two windows cannot have the same title.
    var title = this.Title + ' ' + xIdx + ' ' + yIdx;
    this.Windows[this.Partition[0]][this.Partition[1]] =
            window.open(this.Url, title,
                        'alwaysRaised=yes,titlebar=no,menubar=no,toolbar=no,dependent=yes,left=' + x + ',top=' + y + ',width=' + w + ',height=' + h);
    this.ScreenRectangle.hide();
  };

  WindowManager.prototype.HandleMouseMove = function (event) {
    var w = this.ScreenRectangle.width();
    var h = this.ScreenRectangle.height();
    var x = event.offsetX;
    var y = event.offsetY;

        // offsetX is relative to the source div which can be the
        // WindowRectangle. Change it to be relative to the
        // ScreenRectangle.
    var src = $(event.originalEvent.srcElement);
    while (src[0] !== this.ScreenRectangle[0]) {
      var pos = src.position();
      x += pos.left;
      y += pos.top;
      src = src.parent();
      if (!src) {
        return;
      }
    }

    if (x < w / 3) {
      this.Partition[0] = 0;
      this.WindowRectangle
                .css({'left': '3%',
                  'width': '44%'});
    } else if (x > 2 * w / 3) {
      this.Partition[0] = 2;
      this.WindowRectangle
                .css({'left': '53%',
                  'width': '44%'});
    } else {
      this.Partition[0] = 1;
      this.WindowRectangle
                .css({'left': '3%',
                  'width': '94%'});
    }
    if (y < h / 3) {
      this.Partition[1] = 0;
      this.WindowRectangle
                .css({'top': '3%',
                  'height': '44%'});
    } else if (y > 2 * h / 3) {
      this.Partition[1] = 2;
      this.WindowRectangle
                .css({'top': '53%',
                  'height': '44%'});
    } else {
      this.Partition[1] = 1;
      this.WindowRectangle
                .css({'top': '3%',
                  'height': '94%'});
    }
  };

  SA.WindowManager = WindowManager;
})();

(function () {
  'use strict';

    // TODO: Merge this with the text editor in viewer-utils.
    // Gray out buttons when no text is selected.
    // Remove options to insert link if no text is selected.

  function TextEditor (parent, display) {
    this.Header = $('<div>')
            .appendTo(parent)
            .css({'width': '100%'});

    this.Body = $('<div>')
            .appendTo(parent)
            .css({'width': '100%',
              'position': 'absolute',
              'top': '90px',
              'bottom': '0px'});

        // Add a call back to have the text editor fill available verticle space.
    var self = this;
    this.Header.saOnResize(
            function () {
              var top = self.Header.height();
              if (top === 0) {
                    // Hack because height not set yet.
                setTimeout(function () { self.Header[0].onresize(); }, 250);
                return;
              }
              self.Body.css({'top': top + 'px'});
            });

    this.Display = display;
    this.Parent = parent;
        // I do not want the text editable until the note is set.
    this.Editable = true;
    this.Edit = true;
        // The user can set this to save the note automatically.
    this.ChangeCallback = null;

    this.EditButtons = [];
    this.AddEditButton(SA.ImagePathUrl + 'camera.png', 'link view',
                           function () { self.InsertCameraLink(); });
    this.AddEditButton(SA.ImagePathUrl + 'link.png', 'link URL',
                           function () { self.InsertUrlLink(); });
    this.AddEditButton(SA.ImagePathUrl + 'font_bold.png', 'bold',
                           function () { document.execCommand('bold', false, null); });
    this.AddEditButton(SA.ImagePathUrl + 'text_italic.png', 'italic',
                           function () { document.execCommand('italic', false, null); });
    this.AddEditButton(SA.ImagePathUrl + 'edit_underline.png', 'underline',
                           function () { document.execCommand('underline', false, null); });
    this.AddEditButton(SA.ImagePathUrl + 'list_bullets.png', 'unorded list',
                           function () { document.execCommand('InsertUnorderedList', false, null); });
    this.AddEditButton(SA.ImagePathUrl + 'list_numbers.png', 'ordered list',
                           function () { document.execCommand('InsertOrderedList', false, null); });
    this.AddEditButton(SA.ImagePathUrl + 'indent_increase.png', 'indent',
                           function () { document.execCommand('indent', false, null); });
    this.AddEditButton(SA.ImagePathUrl + 'indent_decrease.png', 'outdent',
                           function () { document.execCommand('outdent', false, null); });
    this.AddEditButton(SA.ImagePathUrl + 'alignment_left.png', 'align left',
                           function () { document.execCommand('justifyLeft', false, null); });
    this.AddEditButton(SA.ImagePathUrl + 'alignment_center.png', 'align center',
                           function () { document.execCommand('justifyCenter', false, null); });
    this.AddEditButton(SA.ImagePathUrl + 'edit_superscript.png', 'superscript',
                           function () { document.execCommand('superscript', false, null); });
    this.AddEditButton(SA.ImagePathUrl + 'edit_subscript.png', 'subscript',
                           function () { document.execCommand('subscript', false, null); });
    this.AddEditButton(SA.ImagePathUrl + 'font_increase.png', 'large font',
                           function () {
                             document.execCommand('fontSize', false, '5');
                             self.ChangeBulletSize('1.5em');
                           });
    this.AddEditButton(SA.ImagePathUrl + 'font_decrease.png', 'small font',
                           function () {
                             document.execCommand('fontSize', false, '2');
                             self.ChangeBulletSize('0.9em');
                           });

    this.AddEditButton(SA.ImagePathUrl + 'question.png', 'add question',
                           function () {
                             self.AddQuestion();
                           });

    this.InitializeHomeButton(this.Header);

    this.TextEntry = $('<div>')
            .appendTo(this.Body)
            .attr('contenteditable', 'true')
            .removeAttr('readonly')
            .css({'box-sizing': 'border-box',
              'width': '100%',
              'height': '100%',
              'overflow': 'auto',
              'resize': 'none',
              'border-style': 'inset',
              'font-size': '10pt',
              'font-family': 'Century Gothic',
              'background': '#f5f8ff'})
            .bind('input', function () {
                // Leave events are not triggering.
              self.EventuallyUpdate();
            })
            .focusin(function () {
              SA.ContentEditableHasFocus = true;
            })
            .focusout(function () {
              SA.ContentEditableHasFocus = false;
              self.Update();
            })
        // Mouse leave events are not triggering.
            .mouseleave(function () { // back button does not cause loss of focus.
              self.Update();
            });

    this.UpdateTimer = null;
        // this.RecordViewTimer = null;

        // Do not enable editing until the Note is set.
    this.EditOff();
    this.Note = null;
  }

  TextEditor.prototype.HomeCallback = function () {
    if (!this.Note) {
      return;
    }
    SA.SetNote(this.Note);
  };

    // Home button is a link.  The link menu is used for other links too.
  TextEditor.prototype.InitializeHomeButton = function (parent) {
    var self = this;
    this.HomeButton = $('<div>')
            .appendTo(parent)
            .text('Home')
            .css({'text-align': 'center',
              'border': '1px solid #666666',
              'border-radius': '10px',
              'margin': '2px',
              'color': '#29C',
              'background': 'white'})
            .hover(function () { $(this).css('color', 'blue'); },
                   function () { $(this).css('color', '#29C'); });
    this.HomeButton.contextmenu(function () { return false; });
    this.HomeButton.mousedown(function (e) {
      if (e.button === 0) {
        self.HomeCallback();
        return false;
      }
      if (e.button === 2) {
        self.LinkMenuObject = {Link: self.HomeButton,
          Note: self.Note};
                // Position and show the properties menu.
        var pos = $(this).position();
                // Cannot delete the root note.
        self.DeleteLinkButton.hide();
        self.LinkMenu
                    .css({'left': (25 + pos.left) + 'px',
                      'top': (pos.top) + 'px'})
                    .show();
        return false;
      }
      return true;
    });

        // When a link is right clicked, the object {Link: ..., Note: ...} is set and the
        // menu is made visible.
    this.LinkMenuObject = undefined;
    this.LinkMenu = $('<div>')
            .appendTo(parent)
            .hide()
            .mouseleave(function () { $(this).hide(); })
            .css({'position': 'absolute',
              'background-color': '#FFFFFF',
              'border': '1px solid #666666',
              'box-sizing': 'border-box',
              'left': '-78px',
              'width': '100px',
              'padding': '0px 2px'});
    $('<button>')
            .appendTo(this.LinkMenu)
            .text('Save View')
            .css({'margin': '2px 0px',
              'width': '100%'})
            .prop('title', 'Replace Annotation')
            .click(
                function () {
                  self.SaveLink(self.LinkMenuObject.Link,
                                  self.LinkMenuObject.Note);
                  self.LinkMenu.hide();
                });
    this.DeleteLinkButton = $('<button>')
            .appendTo(this.LinkMenu)
            .text('Delete')
            .css({'margin': '2px 0px',
              'width': '100%'})
            .click(
                function () {
                  self.DeleteLink(self.LinkMenuObject.Link,
                                    self.LinkMenuObject.Note);
                  self.LinkMenu.hide();
                });
  };

  TextEditor.prototype.StartWindowManagerTimer = function (linkNote, x, y) {
        // I think motion is a better trigger for the window manager.
    this.WindowManagerX = x;
    this.WindowManagerY = y;
        // hint for mouse up (text editor handles the event).
    this.LinkWindowLocation = 0;
        // Start a timer.
    var self = this;
    this.WindowManagerTimer = setTimeout(function () {
      self.WindowManagerTimer = undefined;
      self.ShowWindowManager(linkNote, x, y);
    }, 1000);
  };

  TextEditor.prototype.ShowWindowManager = function (linkNote, x, y) {
    if (this.WindowMangerTimer) {
      clearTimeout(this.WindowManagerTimer);
      this.WindowManagerTimer = undefined;
    }
    if (!SA.windowManager) {
      SA.windowManager = new SA.WindowManager();
    }
    SA.windowManager.Show(x, y,
                              '/webgl-viewer?view=' + linkNote.Id,
                              linkNote.Title);
        // Hack to keep mouse up from loading the note.
    this.LinkWindowLocation = 1;
  };

    // Every time the "Text" is loaded, they hyper links have to be setup.
    // TODO: Do we need to turn off editable?
  TextEditor.prototype.FormatLink = function (linkNote) {
    var self = this;
    var link = document.getElementById(linkNote.Id);
    if (link) {
      $(link)
                .css({'color': '#29C',
                  'background': 'white'})
                .hover(function () { $(this).css('color', 'blue'); },
                       function () { $(this).css('color', '#29C'); })
                .attr('contenteditable', 'false');

      $(link).contextmenu(function () { return false; });
      $(link).mousedown(function (e) {
        if (e.button === 0) {
          self.StartWindowManagerTimer(linkNote, e.pageX, e.pageY);
          return false;
        }
        if (e.button === 2) {
          self.LinkMenuObject = {Link: $(link),
            Note: linkNote};
                    // Position and show the properties menu.
          var pos = $(this).position();
          self.DeleteLinkButton.show();
          self.LinkMenu
                        .css({'left': (25 + pos.left) + 'px',
                          'top': (pos.top) + 'px'})
                        .show();
          return false;
        }
        return true;
      });
      $(link).mousemove(function (e) {
        if (e.which === 1) {
          var dx = e.pageX - self.WindowManagerX;
          var dy = e.pageY - self.WindowManagerY;
          if (Math.abs(dx) + Math.abs(dy) > 5) {
            self.ShowWindowManager(linkNote, e.pageX, e.pageY);
          }
        }
      });

      $(link).mouseup(function (e) {
        if (e.button === 0) {
          if (self.WindowManagerTimer) {
            clearTimeout(self.WindowManagerTimer);
            self.WindowManagerTimer = undefined;
          }
          if (self.LinkWindowLocation === 0) {
            SA.SetNote(linkNote);
            return false;
          }
        }
        return true;
      });
    }
  };

  TextEditor.prototype.SaveLink = function (link, note) {
    note.RecordView(this.Display);
    note.Save();
  };

  TextEditor.prototype.DeleteLink = function (link, note) {
        // TODO: Keep the old text.
    var text = link.text();
    $(document.createTextNode(text)).insertAfter(link);
    link.remove();
    note.DeleteCallback();
    this.UpdateNote();
    this.Note.Save();
  };

  TextEditor.prototype.Change = function (callback) {
    this.ChangeCallback = callback;
  };

  TextEditor.prototype.EventuallyUpdate = function () {
    if (this.UpdateTimer) {
      clearTimeout(this.UpdateTimer);
      this.UpdateTimer = null;
    }
    var self = this;
    this.UpdateTimer = setTimeout(function () { self.UpdateNote(); }, 5000);
  };

  TextEditor.prototype.Update = function () {
    if (this.UpdateTimer) {
      clearTimeout(this.UpdateTimer);
      this.UpdateTimer = null;
    } else {
            // I am using the timer as a modified flag.
            // Call update note to force an update.
      return;
    }
    this.UpdateNote();
  };

  TextEditor.prototype.EditOff = function () {
    if (!this.Edit) { return; }
    this.Edit = false;

    for (var i = 0; i < this.EditButtons.length; ++i) {
      this.EditButtons[i].hide();
    }

    this.TextEntry
            .attr('contenteditable', 'false')
            .attr('spellcheck', 'false')
            .css({'border-style': 'outset',
              'background': '#ffffff'})
            .unbind('input')
            .unbind('focusin')
            .unbind('focusout')
            .unbind('mouseleave')
            .blur();
  };

  TextEditor.prototype.EditableOff = function () {
    this.EditOff();
    this.Editable = false;
  };

  TextEditor.prototype.EditOn = function () {
    var self = this;
    if (!this.Editable) { return; }
    if (this.Edit) { return; }
    this.Edit = true;

    for (var i = 0; i < this.EditButtons.length; ++i) {
      this.EditButtons[i].show();
    }

    this.TextEntry
            .attr('contenteditable', 'true')
            .removeAttr('readonly')
            .css({'border-style': 'inset',
              'background': '#f5f8ff'})
            .bind('input', function () {
              self.Modified = true;
              self.EventuallyUpdate();
            })
            .focusin(function () {
              SA.ContentEditableHasFocus = true;
            })
            .focusout(function () {
              SA.ContentEditableHasFocus = false;
              self.Update();
            })
            .mouseleave(function () { // back button does not cause loss of focus.
              self.Update();
            });
  };

  TextEditor.prototype.AddEditButton = function (src, tooltip, callback) {
    var button = $('<img>');
    if (tooltip) {
            // button = $('<img title="'+tooltip+'">')
      button.prop('title', tooltip);
    }
    button
      .appendTo(this.Header)
      .addClass('editButton')
      .attr('src', src)
      .click(callback);
    this.EditButtons.push(button);
  };

  TextEditor.prototype.AddQuestion = function () {
    var bar = $('<div>')
            .css({'position': 'relative',
              'margin': '3%',
              'width': '90%',
              'background': '#FFF',
              'border': '1px solid #AAA',
              'padding': '1% 1% 1% 1%'}) // top right bottom left
            .attr('contenteditable', 'false')
            .saQuestion({editable: SA.Edit,
              position: 'static'});

        // Need to get the range here because the dialog changes it.
    var self = this;
    var range = SA.GetSelectionRange(this.TextEntry);
        // Try to initialize the dialog with the contents of the range.
    if (!range.collapsed) {
      var clone = range.cloneContents();
      bar.saQuestion('SetQuestionText', clone.firstChild.textContent);
      if (clone.childElementCount > 1) {
                // var answers = clone.querySelectorAll('li');
        var answers = [];
        var first = 0;
        var li = clone.querySelector('li');
        if (li) {
                    // Answers are in a list.
          answers = li.parentElement;
        } else if (clone.childElementCount > 2) {
          answers = clone;
          first = 1;
        } else {
          answers = clone.children[1];
        }
        for (var i = first; i < answers.childElementCount; ++i) {
          var answer = answers.children[i];
          var bold = (answer.style.fontWeight === 'bold') ||
                        ($(answer).find('b').length > 0);
          bar.saQuestion('AddAnswerText',
                                   answer.textContent,
                                   bold);
        }
      }
    }

    bar.saQuestion('OpenDialog',
                       function () {
                         if (range) {
                           range.deleteContents();
                           range.insertNode(document.createElement('br'));
                         } else {
                           range = SA.MakeSelectionRange(self.TextEntry);
                         }
                         range.insertNode(bar[0]);
                           // Some gymnasitcs to keep the cursor after the question.
                         range.collapse(false);
                         var sel = window.getSelection();
                         sel.removeAllRanges();
                         sel.addRange(range);
                         self.TextEntry[0].focus();
                         self.UpdateNote();
                       });
  };

    // execCommand fontSize does change bullet size.
    // This is a work around.
  TextEditor.prototype.ChangeBulletSize = function (sizeString) {
    // This call will clear the selected text if it is not in this editor.
    var range = SA.GetSelectionRange(this.TextEntry);
    range = range || SA.MakeSelectionRange(this.TextEntry);
    var listItems = $('li');
    for (var i = 0; i < listItems.length; ++i) {
      var item = listItems[i];
      if (range.isPointInRange(item, 0) ||
                range.isPointInRange(item, 1)) {
        $(item).css({'font-size': sizeString});
      }
    }
  };

  TextEditor.prototype.InsertUrlLink = function () {
    var self = this;
    var sel = window.getSelection();
        // This call will clear the selected text if it is not in this editor.
    var range = SA.GetSelectionRange(this.TextEntry);
    var selectedText = sel.toString();

    if (!this.UrlDialog) {
      var dialog = new SAM.Dialog(function () {
        self.InsertUrlLinkAccept();
      });
      dialog.Body.css({'margin': '1em 2em'});
      this.UrlDialog = dialog;
      dialog.Dialog.css({'width': '40em'});
      dialog.Title.text('Paste URL link');
      dialog.TextDiv =
                $('<div>')
                .appendTo(dialog.Body)
                .css({'display': 'table-row',
                  'width': '100%'});
      dialog.TextLabel =
                $('<div>')
                .appendTo(dialog.TextDiv)
                .text('Text to display:')
                .css({'display': 'table-cell',
                  'height': '2em',
                  'text-align': 'left'});
      dialog.TextInput =
                $('<input>')
                .appendTo(dialog.TextDiv)
                .val('#30ff00')
                .css({'display': 'table-cell',
                  'width': '25em'});

      dialog.UrlDiv =
                $('<div>')
                .appendTo(dialog.Body)
                .css({'display': 'table-row'});
      dialog.UrlLabel =
                $('<div>')
                .appendTo(dialog.UrlDiv)
                .text('URL link:')
                .css({'display': 'table-cell',
                  'text-align': 'left'});
      dialog.UrlInput =
                $('<input>')
                .appendTo(dialog.UrlDiv)
                .val('#30ff00')
                .css({'display': 'table-cell',
                  'width': '25em'})
                .bind('input', function () {
                  var url = self.UrlDialog.UrlInput.val();
                  if (self.UrlDialog.LastUrl === self.UrlDialog.TextInput.val()) {
                        // The text is same as the URL. Keep them synchronized.
                    self.UrlDialog.TextInput.val(url);
                  }
                  self.UrlDialog.LastUrl = url;
                    // Deactivate the apply button if the url is blank.
                  if (url === '') {
                    self.UrlDialog.ApplyButton.attr('disabled', true);
                  } else {
                    self.UrlDialog.ApplyButton.attr('disabled', false);
                  }
                });
    }

        // We have to save the range/selection because user interaction with
        // the dialog clears the text entry selection.
    this.UrlDialog.SelectionRange = range;
    this.UrlDialog.TextInput.val(selectedText);
    this.UrlDialog.UrlInput.val('');
    this.UrlDialog.LastUrl = '';
    this.UrlDialog.ApplyButton.attr('disabled', true);
    this.UrlDialog.Show(true);
  };

  TextEditor.prototype.InsertUrlLinkAccept = function () {
    var sel = window.getSelection();
    var range = this.UrlDialog.SelectionRange;
    range = range || SA.MakeSelectionRange(this.TextEntry);

        // Simply put a span tag around the text with the id of the view.
        // It will be formated by the note hyperlink code.
    var link = document.createElement('a');
    link.href = this.UrlDialog.UrlInput.val();
    link.target = '_blank';

        // Replace or insert the text.
    if (!range.collapsed) {
            // Remove the seelcted text.
      range.extractContents(); // deleteContents(); // cloneContents
      range.collapse(true);
    }
    var linkText = this.UrlDialog.TextInput.val();
    if (linkText === '') {
      linkText = this.UrlDialog.UrlInput.val();
    }
    link.appendChild(document.createTextNode(linkText));

    range.insertNode(link);
    if (range.noCursor) {
      // Leave the selection the same as we found it.
      // Ready for the next link.
      sel.removeAllRanges();
    }
    this.UpdateNote();
  };

  // TODO: Untangle view links from the note.
  TextEditor.prototype.InsertCameraLink = function () {
        // Create a child note.
    var parentNote = this.Note;
    if (!parentNote) {
      parentNote = SA.display.GetRootNote();
    }

    // TODO: I think an icon as a default view link would look nicer.
    var text = '(view)';
    // Create a new note to hold the view.
    // Put the new note at the end of the list.
    var childIdx = parentNote.Children.length;
    // var childIdx = 0; // begining
    var childNote = parentNote.NewChild(childIdx, text);
    // Setup and save
    childNote.RecordView(this.Display);
    // Block subnotes and separate text.
    childNote.Type = 'View';

    var range = SA.GetSelectionRange(this.TextEntry);
    if (!range) {
      range = SA.MakeSelectionRange(this.TextEntry);
    } else if (!range.collapsed) {
      text = range.toString();
    }
    childNote.Title = text;
    range.deleteContents();

    // Simply put a span tag around the text with the id of the view.
    // It will be formated by the note hyperlink code.
    var span = document.createElement('span');
        // This id identifies the span as a hyperlink to this note.
        // The note will format the link and add callbacks later.
    span.id = childNote.Id;
    $(span).attr('contenteditable', 'false');
    span.appendChild(document.createTextNode(text));
    range.insertNode(span);
        // Let the note format it.
    this.FormatLink(childNote);

        // Some gymnasitcs to keep the cursor after the question.
    range.collapse(false);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    this.TextEntry[0].focus();
        // NOTE: This may not be necesary no that text note "views" are
        // issolated from notes in views tab.
    this.UpdateNote();

    this.Note.Save();
        // Need this because the save button was overwriting the root note
        // view when a camera link was just inserted.
    SA.SetNote(childNote);
  };

  TextEditor.prototype.Resize = function (width, height) {
    var pos;
    pos = this.TextEntry.offset();
    this.TextEntry.height(height - pos.top - 5);
  };

    // No one seems to call this.
  TextEditor.prototype.SetHtml = function (html) {
    console.log("Something called 'TextEditor::SetHtml'");
    if (this.UpdateTimer) {
      clearTimeout(this.UpdateTimer);
      this.Update();
    }
    this.Note = null; // ??? Editing without a note
    this.EditOn();
    this.TextEntry.html(html);

    if (SA.Edit) {
      var items = this.TextEntry.find('.sa-question');
      items.saQuestion({editable: true,
        position: 'static'});
    }

        // Note needed here long term.
        // this looks for keywords in text and makes tags.
    SA.AddHtmlTags(this.TextEntry);
  };

  TextEditor.prototype.GetHtml = function () {
    return this.TextEntry.html();
  };

    // TODO: Editor should not become active until it has a note.
    // This probably belongs in a subclass.
    // Or in the note.
  TextEditor.prototype.LoadNote = function (note) {
    if (this.UpdateTimer) {
      clearTimeout(this.UpdateTimer);
      this.Update();
    }
    this.Note = note;

        // Make the home button highlight like the view links.
    this.HomeButton[0].id = note.Id;
        // .....$('#'+note.Id).css({'background':'#e0e0ff'});

    this.TextEntry.html(note.Text);
        // Note needed here long term.
        // this looks for keywords in text and makes tags.
    SA.AddHtmlTags(this.TextEntry);

    this.UpdateMode(note.Mode);

        // TODO: Hide this.  Maybe use saHtml.
    if (SA.Edit) {
      var items = this.TextEntry.find('.sa-question');
      items.saQuestion({editable: true,
        position: 'static'});
    }

        // TODO: Make the hyper link the same pattern as questions.
    for (var i = 0; i < note.Children.length; ++i) {
            // In the future we can only call this on type "View"
      this.FormatLink(note.Children[i]);
    }

    this.MakeLinksClickable();
    if (SA.Edit) {
      this.EditOn();
    }
        // Bug fix: Next slide button was not showing text because it's
        // the editor's height was 0.
    this.TextEntry.trigger('resize');
  };

    // This gets called when the note's mode changes.
  TextEditor.prototype.UpdateMode = function (mode) {
    if (mode === 'answer-show' && this.Note && this.Note.Title) {
      this.HomeButton.text(this.Note.Title);
    } else {
      this.HomeButton.text('Home');
    }

        // TODO: change this to apply only to the textEntry window.
    if (mode === 'answer-show') {
      $('.sa-note').show();
      $('.sa-notes').show();
      $('.sa-diagnosis').show();
      $('.sa-differential-diagnosis').show();
      $('.sa-teaching-points').show();
      $('.sa-compare').show();
      $('.sa-question').saQuestion('SetMode', mode);
    } else if (mode === 'answer-hide' || mode === 'answer-interactive') {
      $('.sa-note').hide();
      $('.sa-notes').hide();
      $('.sa-diagnosis').hide();
      $('.sa-differential-diagnosis').hide();
      $('.sa-teaching-points').hide();
      $('.sa-compare').hide();
      $('.sa-question').saQuestion('SetMode', mode);
    }
  };

    // Copy the text entry text back into the note
    // (when the textEntry changes).
    // It saves the note too.
  TextEditor.prototype.UpdateNote = function () {
    this.UpdateTimer = null;
    if (!this.Note) {
      return;
    }
    this.Note.Text = this.TextEntry.html();
    if (this.ChangeCallback) {
      (this.ChangeCallback)();
    }

    this.MakeLinksClickable();
  };

    // Link are not active in content editable divs.
    // Work around this.
  TextEditor.prototype.MakeLinksClickable = function () {
    if (SA.Edit) {
            // This is only necesary when div is editable.
            // Links work the same in both situations with this.
      var links = $('a');
      for (var i = 0; i < links.length; ++i) {
        var link = links[i];
        $(link)
                    .click(function () {
                      window.open(this.href, '_blank');
                    });
      }
    }
  };

  SA.TextEditor = TextEditor;
})();

    // ==============================================================================

(function () {
  'use strict';

  function NotesWidget (parent, display) {
    this.ModifiedCallback = null;
    // This is a hack.  I do not know when to save the camera.
    // The save button will save the camera for the last note displayed.
    // This may be different that the selected note because of camera links
    // in text that do not change the text.
    this.DisplayedNote = null;

    // Popup div to display permalink.
    SA.LinkDiv =
            $('<div>')
            .appendTo('body')
            .css({'top': '30px',
              'left': '10%',
              'position': 'absolute',
              'width': '80%',
              'height': '50px',
              'z-index': '3',
              'background-color': '#FFF',
              'border': '1px solid #777',
              'border-radius': '8px',
              'text-align': 'center',
              'padding-top': '26px'})
            .hide()
            .mouseleave(function () { SA.LinkDiv.fadeOut(); });

    // There is not option to show the link when SA.Edit is not on,
    // so this really does nothing.  Editable is probably necessary
    // for selection to copy.
    if (SA.Edit) {
      SA.LinkDiv.attr('contenteditable', 'true');
    }

    var self = this;
    this.Display = display;

    this.Modified = false;
    this.Window = $('<div>')
            .appendTo(parent)
            .css({
              'background-color': 'white',
              'position': 'absolute',
              'top': '0%',
              'left': '0%',
              'height': '100%',
              'width': '100%',
              'z-index': '2'})
            .attr('draggable', 'false')
            .on('dragstart', function () { return false; })
            .attr('id', 'NoteWindow');

    // --------------------------------------------------------------------------

    // GUI elements
    this.TabbedWindow = new SA.TabbedDiv(this.Window);
    this.TextDiv = this.TabbedWindow.NewTabDiv('Text');

    this.UserTextDiv = this.TabbedWindow.NewTabDiv('Notes', 'private notes');
    this.LinksDiv = this.TabbedWindow.NewTabDiv('Views');
    this.LinksRoot = $('<ul>')
            .addClass('sa-ul')
            .css({'padding-left': '0px'})
            .appendTo(this.LinksDiv);

    // for (var i = 0; i < this.Display.GetNumberOfViewers(); ++i) {
    //    this.Display.GetViewer(i).OnInteraction(function (){self.RecordView();});
    // }

    this.LinksDiv
            .css({'overflow': 'auto',
              'text-align': 'left',
              'color': '#303030',
              'font-size': '18px'})
            .attr('id', 'NoteTree');

    // no longer needed, but interesting: 'box-sizing': 'border-box'

    // This is the button for the links tab div.
    if (SA.Edit) {
      this.AddViewButton = $('<button>')
                .appendTo(this.LinksDiv)
                .css({'border-radius': '4px',
                  'margin': '1em'})
                .text('+ New View');
    }

    // Show hidden content to non administrator.
    // Do not show this unless not is interactive.
    this.QuizButton = $('<div>')
            .appendTo(this.TextDiv)
            .addClass('editButton')
            .css({'float': 'right',
              'font-size': 'small',
              'margin-top': '4px',
              'padding-left': '2px',
              'padding-right': '2px',
              'border': '1px solid #AAA',
              'border-radius': '2px'})
            .text('show')
            .hide();

    // Now for the text tab:
    if (SA.Edit) {
            // TODO: Encapsulate this menu (used more than once)
      this.QuizDiv = $('<div>')
                .appendTo(this.TextDiv);
      this.QuizMenu = $('<select name="quiz" id="quiz">')
                .appendTo(this.QuizDiv)
                .css({'float': 'right',
                  'margin': '3px'})
                .change(function () {
                  if (!self.RootNote) { return; }
                  if (this.value === 'review') {
                    self.RootNote.Mode = 'answer-show';
                  } else if (this.value === 'hidden') {
                    self.RootNote.Mode = 'answer-hide';
                  } else if (this.value === 'interactive') {
                    self.RootNote.Mode = 'answer-interactive';
                  }
                  self.UpdateQuestionMode();
                });
      this.QuizLabel = $('<div>')
                .appendTo(this.TextDiv)
                .css({'float': 'right',
                  'font-size': 'small',
                  'margin-top': '4px'})
                .text('quiz');
      $('<option>')
                .appendTo(this.QuizMenu)
                .text('review');
      $('<option>')
                .appendTo(this.QuizMenu)
                .text('hidden');
      $('<option>')
                .appendTo(this.QuizMenu)
                .text('interactive');
            // Set the question mode
      this.QuizMenu.val('review');
    }

    this.TextEditor = new SA.TextEditor(this.TextDiv, this.Display);

    if (!SA.Edit) {
      this.TextEditor.EditableOff();
    } else {
      this.TextEditor.Change(
                function () {
                  self.MarkAsModified();
                });
    }
        // Private notes.
    this.UserTextEditor = new SA.TextEditor(this.UserTextDiv, this.Display);

    this.UserTextEditor.Change(
            function () {
              self.UserTextEditor.Note.Save();
            });
  }

  // TODO: THese methods do not belong in this class.
  // Trying to save user notes quietly.
  // Sort of hackish.
  NotesWidget.prototype.EventuallySaveUserNote = function () {
    if (this.UserNoteTimerId) {
      clearTimeout(this.UserNoteTimerId);
    }
    var self = this;
    this.UserNoteTimerId = setTimeout(function () {
      self.SaveUserNote();
    }, 2000);
  };
  NotesWidget.prototype.Flush = function () {
    if (this.UserNoteTimerId) {
      clearTimeout(this.UserNoteTimerId);
      this.UserNoteTimerId = false;
      this.SaveUserNote();
    }
  };
  // Hackish.
  NotesWidget.prototype.SaveUserNote = function () {
    this.UserNoteTimerId = false;
    var note = SA.notesWidget.GetCurrentNote();
    if (!note || note.ViewerRecords.length === 0) {
      return;
    }
    var userNote = note.ViewerRecords[note.StartIndex].UserNote;

    // TODO: Fix this hack.
    // Make a method in display to record, the save them all.
    if (SA && SA.display) {
      // TODO: Fix: This will not work because previous widgets will
      // be in both widgets, but new widgets will only be in one.
      // I do not want to duplicate widgets in the note.
      // for (var i = 0; i < SA.display,GetNumberOfViewers(); ++i) {
      for (var i = 0; i < 1; ++i) {
        userNote.ViewerRecords[0].CopyAnnotations(SA.display.GetViewer(i), true);
      }
    }

    if (userNote.ViewerRecords[0].Annotations.length > 0 ||
            userNote.LoadState === 2) {
      userNote.Save();
    }
  };

  // Needed so administrators can create usernotes.
  NotesWidget.prototype.IsUserTextTabOpen = function () {
    if (this.TabbedWindow.GetCurrentDiv() === this.UserTextDiv) {
      return true;
    }
    return false;
  };

  NotesWidget.prototype.UpdateQuestionMode = function () {
    // Set the question mode
    if (!this.RootNote) {
      return;
    }

    if (!this.RootNote.Mode) {
      this.RootNote.Mode = 'answer-show';
    }

    if (this.QuizMenu) {
      if (this.RootNote.Mode === 'answer-hide') {
        this.QuizMenu.val('hidden');
      } else if (this.RootNote.Mode === 'answer-interactive') {
        this.QuizMenu.val('interactive');
      } else {
                // this.RootNote.Mode = 'answer-show';
        this.QuizMenu.val('review');
      }
    }
    if (this.RootNote.Mode === 'answer-interactive') {
      var self = this;
      this.QuizButton
                .show()
                .css('background-color', '')
                .click(function () {
                  self.SetAnswerVisibility('answer-show');
                  self.QuizButton.css({'background-color': '#AAAAAA'});
                });
    } else {
      this.QuizButton.hide();
    }

    this.SetAnswerVisibility(this.RootNote.Mode);
  };

  NotesWidget.prototype.SetAnswerVisibility = function (mode) {
        // make sure tags have been decoded.
    SA.AddHtmlTags(this.TextEditor.TextEntry);

    this.TextEditor.UpdateMode(mode);
  };

  NotesWidget.prototype.SetNavigationWidget = function (nav) {
    this.NavigationWidget = nav;
  };

  NotesWidget.prototype.SetModifiedCallback = function (callback) {
    this.ModifiedCallback = callback;
  };

  NotesWidget.prototype.SetModifiedClearCallback = function (callback) {
    this.ModifiedClearCallback = callback;
  };

    // Two types of select.  This one is from the views tab.
    // It sets the text from the note.
    // There has to be another from text links.  That does not set the
    // text.
  NotesWidget.prototype.SetNote = function (note) {
        // NOTE: Even if note === this.SelectedNote we still need to add the
        // user note annotations because display resets the annotations of
        // the view. this user may have changed annotations without
        // changing the note.

    var ancestor = note;
    while (ancestor !== this.RootNote &&
               ancestor.Parent &&
               ancestor.Type !== 'UserNote') {
      ancestor = ancestor.Parent;
    }

        // Check to see if we have to set a new root note.
        // If note is not in the root note's family, set a new root.
        // Avoid decendants of user notes.
    if (ancestor !== this.RootNote && ancestor.Type !== 'UserNote') {
            // This will call SetNote again when root note is set.
      this.SetRootNote(ancestor);
      return;
    }

        // This should method should be split between Note and NotesWidget
        // Make the permalink window fade out if it is visible.
    if (SA.LinkDiv.is(':visible')) { SA.LinkDiv.fadeOut(); }

        // If the note is a view link, use the text of the parent.
    if (ancestor.Type !== 'UserNote') {
      var textNote = note;
      while (textNote && textNote.Type === 'View') {
        textNote = textNote.Parent;
      }
      if (textNote) {
        this.TextEditor.LoadNote(textNote);
      }
    }

    if (note === this.SelectedNote) {
      return;
    }

        // Handle the note that is being unselected.
        // Clear the selected background of the deselected note.
    if (this.SelectedNote) {
      this.SelectedNote.TitleEntry.css({'background': 'white'});
            // Make the old hyper link normal color.
      $('#' + this.SelectedNote.Id).css({'background': 'white'});
    }

    this.SelectedNote = note;

        // Display the user note text.
    this.UpdateUserNotes();

        // Indicate which note is selected in the Views tab
    note.TitleEntry.css({'background': '#f0f0f0'});
        // Probably does nothing.
        // note.SelectHyperlink();

        // Indicate which note / view link is selected in the text.
    $('#' + note.Id).css({'background': '#e0e0ff'});
  };

  NotesWidget.prototype.MarkAsModified = function () {
    if (this.ModifiedCallback) {
      this.ModifiedCallback();
    }
    this.Modified = true;
  };

  NotesWidget.prototype.MarkAsNotModified = function () {
    if (this.ModifiedClearCallback) {
      this.ModifiedClearCallback();
    }
    this.Modified = false;
  };

  NotesWidget.prototype.SetRootNote = function (rootNote) {
    if (this.UpdateTimer) {
      clearTimeout(this.UpdateTimer);
      this.Update();
    }
        // this.Display.SetNote();

    this.RootNote = rootNote;
    this.DisplayRootNote();

    this.UpdateQuestionMode();
  };

    // TODO:
    // Hmmmm.  I do not think this is used yet.
    // SA.SaveButton setup should not be here though.
  NotesWidget.prototype.EditOn = function () {
    SA.SaveButton
            .prop('title', 'save to database')
            .attr('src', SA.ImagePathUrl + 'save22.png')
            .click(function () { self.SaveCallback(); });
    this.AddViewButton.show();
    this.TextEditor.EditOn();
  };

  NotesWidget.prototype.EditOff = function () {
    SA.SaveButton
            .prop('title', 'edit view')
            .attr('src', SA.ImagePathUrl + 'text_edit.png')
            .click(function () { self.EditOn(); });
    this.AddViewButton.hide();
    this.TextEditor.EditOff();

        /*
          .. note camera buttons....
          .. note title entry (content editable.) ....
          .. note remove button ...
          .. link and delete button ...
          .. Stack stuff ...
        */
  };

  NotesWidget.prototype.SaveCallback = function (finishedCallback) {
        // Process containers for diagnosis ....
    SA.AddHtmlTags(this.TextEditor.TextEntry);

    SA.display.RecordAnnotations();

    var note = this.GetCurrentNote();
    if (note) {
            // Lets try saving the camera for the current note.
            // This is a good comprise.  Do not record the camera
            // every time it moves, but do record it when the save button
            // is pressed.  This is ok, now that view links are visibly
            // selected. However, It is still not really obvious what will happen.
      note.RecordView(this.Display);
            // Record view does this too.
            // note.RecordAnnotations(this.Display);
    }

        // Root saves all the children with it.
        // There is always a root note.  Being over cautious.
        // May need to save text of the root note because it is displayed
        // even when view/camera links are the current note.
    if (this.RootNote) {
      note = this.RootNote;
    }
    note.NotesPanelOpen = (SA.resizePanel && SA.resizePanel.Visibility);
    var self = this;
    note.Save(function () {
      self.Modified = false;
      if (finishedCallback) {
        finishedCallback();
      }
    });
  };

    // ------------------------------------------------------------------------------

  NotesWidget.prototype.GetCurrentNote = function () {
    return this.Display.GetNote();
  };

  NotesWidget.prototype.SaveBrownNote = function () {
    // Create a new note.
    var note = new SA.Note();
    note.RecordView(this.Display);

    // This is not used and will probably be taken out of the scheme,
    note.SetParent(this.GetCurrentNote());
  };

    // Randomize the order of the children
  NotesWidget.prototype.RandomCallback = function () {
    var note = this.GetCurrentNote();
    note.Children.sort(function (a, b) { return Math.random() - 0.5; });
    note.UpdateChildrenGUI();
  };

    // Called when a new slide/view is loaded.
  NotesWidget.prototype.DisplayRootNote = function () {
    if (!this.RootNote) { return; }

        // Set the state of the notes widget.
        // Should we ever turn it off?
    if (SA.resizePanel) {
      SA.resizePanel.SetVisibility(this.RootNote.NotesPanelOpen, 0.0);
    }

    this.TextEditor.LoadNote(this.RootNote);
    this.LinksRoot.empty();
    this.RootNote.DisplayGUI(this.LinksRoot);
    this.SetNote(this.RootNote);

        // Add an obvious way to add a link / view to the root note.
    if (SA.Edit) {
      var self = this;
      this.AddViewButton
                .appendTo(this.LinksDiv)
                .click(function () {
                  var parentNote = SA.notesWidget.RootNote;
                  var childIdx = parentNote.Children.length;
                  var childNote = parentNote.NewChild(childIdx, 'New View');
                    // Setup and save
                  childNote.RecordView(self.Display);
                    // We need to save the note to get its Id (for the link div).
                  childNote.Save();
                  parentNote.UpdateChildrenGUI();
                  this.Display.SetNote(childNote);
                    // self.SetNote(childNote);
                });
    }
        // Default to old style when no text exists (for backward compatability).
    if (this.RootNote.Text === '') {
      this.TabbedWindow.ShowTabDiv(this.LinksDiv);
    } else {
      this.TabbedWindow.ShowTabDiv(this.TextDiv);
    }
  };

    // Add a user note to the currently selected notes children.
  NotesWidget.prototype.NewCallback = function () {
    var note = this.GetCurrentNote();
    var childIdx = 0;
    if (note.Parent) {
      var idx = note.Children.indexOf(note);
      if (idx >= 0) {
        childIdx = idx + 1;
        note = note.Parent;
      }
    }
        // Create a new note.
    var childNote = note.NewChild(childIdx, 'New View');
        // Setup and save
    childNote.RecordView(this.Display);
        // childNote.Save();
    note.UpdateChildrenGUI();

    note.Save();
        // this.SetNote(childNote);
    this.Display.SetNote(childNote);
  };

    // TODO: Make sure method names are consistent.  Update shoud be for
    // updating the GUI. Record should be for moving gui changes to notes.
    // Display the user notes text.
    // We have only one text editor so only display the text form the first
    // user note.
  NotesWidget.prototype.UpdateUserNotes = function () {
        // Even if the userNote did not change, we still need to render the annotation.
        // User notes are always editable. Unless it this the demo account.
    if (SA.User !== '' && SA.VIEWER1) {
      this.UserTextEditor.EditOn();
    }

    var note = this.SelectedNote;
    if (note && note.ViewerRecords.length > 0) {
      var userNote = note.ViewerRecords[note.StartIndex].UserNote;

            // Must display the text.
      this.UserTextEditor.LoadNote(userNote);
    }
  };

  SA.NotesWidget = NotesWidget;
})();
