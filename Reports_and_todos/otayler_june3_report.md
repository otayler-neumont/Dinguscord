PROGRESS REPORT: 13 files changed, 4147 lines of code added, 2474 lines of code deleted

All Changes
    - fixed usernames not displaying in rich messaging
    - switched onlinepresence to be handled by messaging service
        - this was a bad idea and created the bug where if a tab went inactive or the user clicked off the window they got marked offline
    - switched BACK to onlinepresence being its own microservice
        - uses a 60 second constantly open socketio connection to ping status. If a checkin fails then a user gets automarked offline
    - added ability to add friends to user accounts
    - updated sql schema for users to support friendslists
    - added ui feature to show online and offline friends (fuck the tiny green circles they are evil)
    - added auto refresh and socketio connection checking for presence tracking
    - built a brand new "dm" system into friends feature that utilizes the schema for chatrooms
    - removed dm's from chatroom area
    - added functionality to create and launch dm's from friends list
    - added ability to remove friends
    - added ability to search friends on the dashboard
    - restructured UI to remove button clutter
    - rebuilt logout function to handle logouts gracefully
    - fixed authentication persistance accross full rebuilds
    - disabled hot-reloading completely for docker

Known Bugs
    - UI loads a really ugly template on first login. It goes away for the session with a page refresh.
    - when you get kicked out to login on a full rebuild through the script if you do not refresh the page sign up throws an error, on refresh if error was thrown it logs you in anyway using the sign in that errored (so it creates, and doesn't route to dashboard)
    - online/offline status struggles updating in the UI if the logout button isn't used

Features to Implement
    - user profile editing
    - remove unneeded ui template crap in the "quick actions" box
    - chatroom recursive deleting (also deletes all messages)
    - cleanup UI

