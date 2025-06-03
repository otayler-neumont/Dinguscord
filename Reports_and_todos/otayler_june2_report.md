PROGRESS REPORT: 33 files changed, 6778 lines of code added, 3545 lines of code deleted

SCRIPTS
    - added scripts to completely teardown the entire project and rebuild it
        this includes fully reseting the databases and building them back from scratch
    - moved all scripts to a scripts folder to clean up the main directory

README
    - moved all readmes to their own folder
    - added readmes to explain how the database rebuild scripts work
    
UI
    - Deleted all mock data to stop broken parts from appearing to work
    - added ability to logout
    - adjusted ui interface for better widescreen support
    - adjusted ui to correctly pull usernames in welcome screen
    - hooked up chatroom module to chatroom api
    - added ability to create new chatrooms
    - added ability to add people to chatrooms
    - added popup to search users by username
    - rebuilt UI to run from docker instead of locally

ChatroomService
    - Deleted all mock data to stop broken parts from appearing to work
    - Switched and fully recoded chatroom persistance from in memory json files to SQL database
    - built out database schema for chatrooms
    - updated package.json
    - Switched database id from random string to the inputed chatroom name
    - added graceful handling of duplicate chatroom name entry
    - Added JWT authentication to chatroom creation
    - blocked users from adding themselves to chatrooms

MessageService
    - Deleted all mock data to stop broken parts from appearing to work
    - switched on socketIO to facilitate realtime messaging between clients
    - added rich username support to the message packet for chatroom to use to display usernames
    - Added username enrichment to fetch real usernames from AuthenticationService (not working)
    - Fixed port configuration for microservice communication

AuthenticationService
    - added JWT authentication for searching users
    - added api endpoint to search users by display and user name (not userId)

Known Bugs
    - if you run the full rebuild script while users are logged in, it will allow the users to do authenticated tasks
        like create chatrooms. When they logout the auth disappears and the chatroom becomes unaccessable
    - UI hot-reloading isn't working, meaning you have to rebuild the service to see changes made in the code
    - UI messages are displaying a usernumber for sent messages rather than a display name. 
    - UI loads a really ugly template on first login. It goes away for the session with a page refresh.

Features to Implement
    - searching users on the dashboard
    - adding friends to user accounts
    - displaying online presence in the dashboard
    - direct messages to friends and other users
    - user profile editing
    - remove unneeded ui template crap in the "quick actions" box
    - chatroom recursive deleting (also deletes all messages)
    - cleanup UI

    



