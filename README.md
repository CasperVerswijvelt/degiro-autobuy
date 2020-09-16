# Degiro ETF autobuy script

This script will read your desired portfolio from a config file, and work up to those ratio's automatically when you depisit money in your DeGiro account.

This script uses nodejs and can be run as a Google Cloud Function. For our limited usage it will be free. I schedule it to run every day at 14:00 but you can choose something that works for you.

## How to install

- Head over to [Google Cloud Console](https://console.cloud.google.com/)
- In the top bar, click `Select a project` and t hen ch oose `New project`. Choose a name of your liking.
- If the project did not get selected (see top bar), select it.
- In the side hamburger menu choose `Cloud-functions`, under the `Compute` category
- You will need to have an account with billing enabled, so a creditcard will be required. However our use will be so little that it doesn't cost money. Just follow the instructions on the page to do this. You can start with a 90 day trial and 300 dollars in credit, but switching to a full account will be free too for our usecase.
- Go back to the `Cloud-functions` page and press `Create function`
- Give the function a name and choose a region. I just chose a region close to where I live.
- For trigger type select `Cloud Pub/Sub`
- Click the subject field and create a new subject. Remember the name you choose. Leave the encryption to what it is.
- When done press the `Save` button
- Click `VARIABLES, NETWORKING AND ADVANCED SETTINGS
- In the advanced tab set maximum amount of function instances to 1.
- In the environment variables tab, add 2 variables:
  - DEGIRO_USER: Value for this should be your DeGiro username
  - DEGIRO_PWD: Value for this should be your DeGiro password
- Press `Next`
- Select `Node.js 12` for runtime,
- Input `runScript` in the `Entrypoint field`
- If there is a message `Cloud Build API is required to use the runtime selected.`, press `Enable API`, and press `Enable` in the tab that opened. Close this tab now and go back to the previous tab.
- Make sure the source code field is set to `Inline Editor`.
- Mirror the file setup in this repository: create the files `index.js`, `script.js`, `package.json`, `package-lock.json`, `config.json` and copy their contents using the inline editor. You can configure the `config.json` file to your liking.
- Click `Implement`.
- Back in the list view, click your created function. If it is done building, go to the test tab and press `Test this function`
- Wait until the logs show up, if everything is correcct you will see logs like this:
  ```
  Started degiro-autobuy script
  Desired portfolio: IWDA (63.77%), VUSA (6.52%), EQQQ (6.52%), EMIM (8.70%), INRG (14.49%)
  Cash in account (-22.21) is less than minimum cash funds (500).
  ```
  This will ofcourse vary for your situation
- Now we need to make this script execute every day
- Open the side menu and select `Cloud scheduler` under `TOOLS`
- Click `Create task`
- Select a region you like and click next, again I chose a region close to me
- Give your scheduler a name, for example daily-degiro-autobuy
- For frequency you can use a cron expression: `0 14 * * *` means that it will run every day at 14:00.
- Select your timezone
- For purpose, select Pub/Sub
- In subject field, select the name for the subject you chose before when creating our function
- For payload just put something random, it doesn't matter and click finish
- To test if this scheduler works, press the `Run now` button
- In the side bar again select `Cloud-functions` and in the 3 dots for your function, click `View logs`
- Check if the logs show that your script ran after running the schedule.
- Done
