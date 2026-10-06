if(!com) var com={};
if(!com.twsrdm) com.twsrdm={};

com.twsrdm.QuickSort =
{
  daten                : Array (),
  taskStackL           : Array (),
  taskStackR           : Array (),
  stillSorting         : true,
  links                : 0,
  rechts               : 0,
  numMaxVertauschungen : 0,
  step                 : 0,
  comp                 : function (a,b) {},
  doneFunction         : function () {},


  SetDoneFunction : function ( f )
  {
    this.doneFunction = f;
  },
   
  SetArray : function ( a )
  {
    this.daten = a;
  },

  SetCompare : function ( f )
  {
    this.comp = f;
  },

  Start : function ()
  {
    this.stillSorting = true;
    this.numMaxVertauschungen = Math.ceil ( 4 * this.daten.length * Math.log (this.daten.length) / Math.LN10);
    while (this.taskStackL.pop());
    while (this.taskStackR.pop());
    this.taskStackL.push (0);
    this.taskStackR.push (this.daten.length-1);
    setTimeout ( function() {this.teile(0,0,0, this);}, 10 );
  },



  teile : function ( p_i, p_j, p_pivot, obj )
  {
    while (obj.stillSorting)
    {
      var cont = false;
      var temp;
      
      if ( p_i!=0 || p_j!=0 || p_pivot!=0 )
        cont = true;
      
      if (!cont)
      {
        obj.links  = obj.taskStackL.pop();
        obj.rechts = obj.taskStackR.pop();
      }

      if (obj.rechts > obj.links || cont )
      {
        var i,j,pivot;
      
        if ( !cont )
        {
          i = obj.links;
          j = obj.rechts-1;
          pivot = obj.rechts;
        }
        else
        {
          i = p_i;
          j = p_j;
          pivot = p_pivot;
          cont = false;
          p_i=0;p_j=0;p_pivot=0;
        }
        
        while (true)
        {
          while ( obj.comp (obj.daten[i], obj.daten[pivot]) )
          {
            i++;
            obj.step++;
            if (obj.step%500==0)
            {
              com.twsrdm.Rdm.dfStatusText.label = com.twsrdm.Rdm.dfBundle.getString("removeduplicates.phase") + " 2: " + obj.step + " / ~" + obj.numMaxVertauschungen;
              com.twsrdm.Rdm.dfProgbar.value = 100 * obj.step / obj.numMaxVertauschungen;
              setTimeout ( function() {com.twsrdm.QuickSort.teile(i,j,pivot, obj);}, 10 );
              return;
            }
          }
          while ( obj.comp (obj.daten[pivot], obj.daten[j])  && (j > obj.links) )
          {
            j -= 1;
            obj.step++;
            if (obj.step%500==0)
            {
              com.twsrdm.Rdm.dfStatusText.label = com.twsrdm.Rdm.dfBundle.getString("removeduplicates.phase") + " 2: " + obj.step + " / ~" + obj.numMaxVertauschungen;
              com.twsrdm.Rdm.dfProgbar.value = 100 * obj.step / obj.numMaxVertauschungen;
              setTimeout ( function() {com.twsrdm.QuickSort.teile(i,j,pivot, obj);}, 10 );
              return;
            }
          }
          if (i >= j) break;
          temp = obj.daten[i];
          obj.daten[i] = obj.daten[j];
          obj.daten[j] = temp;
        } // while true

        temp = obj.daten[i];
        obj.daten[i] = obj.daten[pivot];
        obj.daten[pivot] = temp;

        obj.taskStackL.push (obj.links);
        obj.taskStackR.push (i-1);
        obj.taskStackL.push (i+1);
        obj.taskStackR.push (obj.rechts);
      }
      if ( obj.taskStackL.length == 0 || obj.taskStackR.length == 0 )
      {
        com.twsrdm.Rdm.dfStatusText.label = com.twsrdm.Rdm.dfBundle.getString("removeduplicates.phase") + " 2: " + obj.step + " / ~" + obj.numMaxVertauschungen;
        com.twsrdm.Rdm.dfProgbar.value = 100;
        obj.stillSorting = false;
        obj.doneFunction(0);
//        com.twsrdm.QuickSort.doneFunction();
      }
    } // while (stillSoring)
  }

}
