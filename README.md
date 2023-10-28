# Chrome Tabs Backup

A chrome extension to help backup the list of open tabs as a markdown table.

For folks like me who treat open tabs as a sloppy knowledge database and
are afraid to close them due to fear of missing out and/or don't have the
time to organize the information in 100s of open tabs, this extension will
help relieve the anxiety associated with closing the tabs. When you have a
table of all opened tabs, you can convince yourself that you can get to these
tabs if you really need them. At the same time you are freeing your
workspace/browser to explore more.

## How to use?

Clone this repo and follow [the official chrome extension developer guide](https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked)
to load this extension as an unpacked extension.

Click on the extension icon and click on "Show tabs" button. This will
display a markdown table of all open tabs. It will also copy this table
to your clipboard automatically. Additionally, it will close any duplicate
tabs.

Once you have copied the markdown table, you can use the browser's built-in
mechanism to close all tabs. From the menu choose `Close Other Tabs` and
then manually close the last tab.

