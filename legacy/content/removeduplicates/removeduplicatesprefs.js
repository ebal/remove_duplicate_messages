if(!com) var com={};
if(!com.twsrdm) com.twsrdm={};

com.twsrdm.PrefDialog =
{
   pmpBoolean : 0,
   pmpNumber  : 1,
   pmpString  : 2,

   init : function ()
   {
     document.getElementById ( 'removeduplicatesMessageIdPref' ).checked             = this.checkMessageIdPref();
     document.getElementById ( 'removeduplicatesDateInSecondsPref' ).checked         = this.checkDateInSecondsPref();
     document.getElementById ( 'removeduplicatesDatePref' ).checked                  = this.checkDatePref();
     document.getElementById ( 'removeduplicatesSubjectPref' ).checked               = this.checkSubjectPref();
     document.getElementById ( 'removeduplicatesAuthorPref' ).checked                = this.checkAuthorPref();
     document.getElementById ( 'removeduplicatesLinecountPref' ).checked             = this.checkLinecountPref();
     document.getElementById ( 'removeduplicatesBodyPref' ).checked                  = this.checkBodyPref();
     document.getElementById ( 'removeduplicatesRecipientPref' ).checked             = this.checkRecipientPref();
     document.getElementById ( 'removeduplicatesReverseSearchPref' ).checked         = this.checkReverseSearchPref();
     document.getElementById ( 'removeduplicatesSubFolderFirstPref' ).checked        = this.checkSubFolderFirstPref();
     document.getElementById ( 'removeduplicatesExcludeTrashcanPref' ).checked       = this.checkExcludeTrashcanPref();
     document.getElementById ( 'removeduplicatesExcludeSentfolderPref' ).checked     = this.checkExcludeSentfolderPref();
     document.getElementById ( 'removeduplicatesAutodeletePref' ).checked            = this.checkAutodeletePref();
     document.getElementById ( 'removeduplicatesShowDuplicatesDialogPref' ).checked  = this.checkShowDuplicatesDialogPref();
     document.getElementById ( 'removeduplicatesDebugInfoPref' ).checked             = this.checkDebugInfoPref();
     document.getElementById ( 'removeduplicatesPreferedDeletePref' ).selectedIndex  = this.checkPreferedDeletePref();
   },



   save : function()
   {
     var checkMessageId       = document.getElementById('removeduplicatesMessageIdPref').checked;
     var checkDateInSeconds   = document.getElementById('removeduplicatesDateInSecondsPref').checked;
     var checkDate            = document.getElementById('removeduplicatesDatePref').checked;
     var checkSubject         = document.getElementById('removeduplicatesSubjectPref').checked;
     var checkAuthor          = document.getElementById('removeduplicatesAuthorPref').checked;
     var checkLinecount       = document.getElementById('removeduplicatesLinecountPref').checked;
     var checkBody            = document.getElementById('removeduplicatesBodyPref').checked;
     var checkRecipient       = document.getElementById('removeduplicatesRecipientPref').checked;
     var reverseSearch        = document.getElementById('removeduplicatesReverseSearchPref').checked;
     var subFolderFirst       = document.getElementById('removeduplicatesSubFolderFirstPref').checked;
     var excludeTrashcan      = document.getElementById('removeduplicatesExcludeTrashcanPref').checked;
     var excludeSentfolder    = document.getElementById('removeduplicatesExcludeSentfolderPref').checked;
     var autodelete           = document.getElementById('removeduplicatesAutodeletePref').checked;
     var showDuplicatesDialog = document.getElementById('removeduplicatesShowDuplicatesDialogPref').checked;
     var debugInfo            = document.getElementById('removeduplicatesDebugInfoPref').checked;
     var preferedDelete       = document.getElementById('removeduplicatesPreferedDeletePref').selectedIndex;

     this.pmpWritePref ( 'extensions.removeduplicates.checkmessageid',       checkMessageId,       this.pmpBoolean );
     this.pmpWritePref ( 'extensions.removeduplicates.checkdateinseconds',   checkDateInSeconds,   this.pmpBoolean );
     this.pmpWritePref ( 'extensions.removeduplicates.checkdate',            checkDate,            this.pmpBoolean );
     this.pmpWritePref ( 'extensions.removeduplicates.checksubject',         checkSubject,         this.pmpBoolean );
     this.pmpWritePref ( 'extensions.removeduplicates.checkauthor',          checkAuthor,          this.pmpBoolean );
     this.pmpWritePref ( 'extensions.removeduplicates.checklinecount',       checkLinecount,       this.pmpBoolean );
     this.pmpWritePref ( 'extensions.removeduplicates.checkbody',            checkBody,            this.pmpBoolean );
     this.pmpWritePref ( 'extensions.removeduplicates.checkrecipient',       checkRecipient,       this.pmpBoolean );
     this.pmpWritePref ( 'extensions.removeduplicates.reversesearch',        reverseSearch,        this.pmpBoolean );
     this.pmpWritePref ( 'extensions.removeduplicates.subfolderfirst',       subFolderFirst,       this.pmpBoolean );
     this.pmpWritePref ( 'extensions.removeduplicates.autodelete',           autodelete,           this.pmpBoolean );
     this.pmpWritePref ( 'extensions.removeduplicates.excludeTrashcan',      excludeTrashcan,      this.pmpBoolean );
     this.pmpWritePref ( 'extensions.removeduplicates.excludeSentfolder',    excludeSentfolder,    this.pmpBoolean );
     this.pmpWritePref ( 'extensions.removeduplicates.debuginfo',            debugInfo,            this.pmpBoolean );
     this.pmpWritePref ( 'extensions.removeduplicates.showDuplicatesDialog', showDuplicatesDialog, this.pmpBoolean );
     this.pmpWritePref ( 'extensions.removeduplicates.prefereddelete',       preferedDelete,       this.pmpNumber );
   },



   checkMessageIdPref : function()
   {
     var h = this.pmpReadPref ( 'extensions.removeduplicates.checkmessageid',this.pmpBoolean);
     if (h == null) h = true;
     return h;
   },



   checkDateInSecondsPref : function()
   {
     var h = this.pmpReadPref ( 'extensions.removeduplicates.checkdateinseconds',this.pmpBoolean);
     if (h == null) h = true;
     return h;
   },



   checkDatePref : function()
   {
     var h = this.pmpReadPref ( 'extensions.removeduplicates.checkdate',this.pmpBoolean);
     if (h == null) h = false;
     return h;
   },



   checkSubjectPref : function()
   {
     var h = this.pmpReadPref ( 'extensions.removeduplicates.checksubject',this.pmpBoolean);
     if (h == null) h = true;
     return h;
   },



   checkAuthorPref : function()
   {
     var h = this.pmpReadPref ( 'extensions.removeduplicates.checkauthor',this.pmpBoolean);
     if (h == null) h = true;
     return h;
   },



   checkLinecountPref : function()
   {
     var h = this.pmpReadPref ( 'extensions.removeduplicates.checklinecount',this.pmpBoolean);
     if (h == null) h = false;
     return h;
   },



   checkBodyPref : function()
   {
     var h = this.pmpReadPref ( 'extensions.removeduplicates.checkbody',this.pmpBoolean);
     if (h == null) h = false;
     return h;
   },



   checkRecipientPref : function()
   {
     var h = this.pmpReadPref ( 'extensions.removeduplicates.checkrecipient',this.pmpBoolean);
     if (h == null) h = false;
     return h;
   },



   checkReverseSearchPref : function()
   {
     var h = this.pmpReadPref ( 'extensions.removeduplicates.reversesearch',this.pmpBoolean);
     if (h == null) h = false;
     return h;
   },



   checkSubFolderFirstPref : function()
   {
     var h = this.pmpReadPref ( 'extensions.removeduplicates.subfolderfirst',this.pmpBoolean);
     if (h == null) h = false;
     return h;
   },



   checkExcludeTrashcanPref : function()
   {
     var h = this.pmpReadPref ( 'extensions.removeduplicates.excludeTrashcan',this.pmpBoolean);
     if (h == null) h = true;
     return h;
   },



   checkExcludeSentfolderPref : function()
   {
     var h = this.pmpReadPref ( 'extensions.removeduplicates.excludeSentfolder',this.pmpBoolean);
     if (h == null) h = true;
     return h;
   },



   checkAutodeletePref : function()
   {
     var h = this.pmpReadPref ( 'extensions.removeduplicates.autodelete',this.pmpBoolean);
     if (h == null) h = false;
     return h;
   },



   checkShowDuplicatesDialogPref : function()
   {
     var h = this.pmpReadPref ( 'extensions.removeduplicates.showDuplicatesDialog',this.pmpBoolean);
     if (h == null) h = false;
     return h;
   },



   checkDebugInfoPref : function()
   {
     var h = this.pmpReadPref ( 'extensions.removeduplicates.debuginfo',this.pmpBoolean);
     if (h == null) h = false;
     return h;
   },



   checkPreferedDeletePref : function()
   {
     var h = this.pmpReadPref ( 'extensions.removeduplicates.prefereddelete',this.pmpNumber);
     if (h == null) h = 0;
     return h;
   },



   pmpWritePref : function(pmpName, pmpValue, pmpType)
   {
     var nsIPrefBranch = Components.interfaces.nsIPrefBranch;
     var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(nsIPrefBranch);
     switch (pmpType)
     {
       case this.pmpBoolean: pref.setBoolPref ( pmpName, pmpValue ); break;
       case this.pmpNumber:  pref.setIntPref  ( pmpName, pmpValue ); break;
       case this.pmpString:  pref.setCharPref ( pmpName, pmpValue ); break;
     }
   },


   pmpReadPref : function(pmpName, pmpType)
   {    
     var nsIPrefBranch = Components.interfaces.nsIPrefBranch;
     var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(nsIPrefBranch);
     var pmpValue = null;
   
     if (pref.prefHasUserValue(pmpName))
     {
       switch ( pmpType )
       {
         case this.pmpBoolean: pmpValue = pref.getBoolPref(pmpName); break;
         case this.pmpNumber:  pmpValue = pref.getIntPref(pmpName);  break;
         case this.pmpString:  pmpValue = pref.getCharPref(pmpName); break;
       }
     }
     return pmpValue;
   },


   showRemoveDuplicatesPrefs : function()
   {
      window.openDialog("chrome://removeduplicates/content/removeduplicatesprefs.xul", "removeduplicates", "chrome" );
   }
}
