# Stackathon

Stackathon is a command-line program for [io.js](https://iojs.org/en/index.html) that walks users through the process of setting up and tearing down basic server stacks on [Digital Ocean](https://www.digitalocean.com/). It can also set simple DNS records for domains purchased from [Namecheap](https://www.namecheap.com/). The program was designed with hackathons in mind so that participants can spend less time getting setup and more time hacking.

NOTE: This has been tested throughly on Mac OS X. It will probably work on any *nix system, but your milage may vary on Windows boxes.

## Quickstart

##### Installation

Install the Stackathon module globally via NPM:

```
npm install stackathon -g
```

##### Get Your Credentials

Generate a new Digital Ocean API token with read and write access [in your account settings page](https://cloud.digitalocean.com/settings/tokens/new).

You will also need [your Namecheap API  token](https://manage.www.namecheap.com/myaccount/modify-profile-api.asp?APIACCESS.x=1&rkey=NC). And will have to whitelist your current IP address on that same page. Your IP address changes periodically, like when you connect to a new WiFi network, so you may have to do this more than once. If you don't know how to find your IP address, [just ask Google](https://www.google.com/#q=what+is+my+ip+address).

Namecheap is not required to use Stackathon. If you do decide to use it, be sure to read the [Setting DNS Records With Namecheap](#setting-dns-records-with-namecheap-optional) section below.

##### Build a Stack

To build a new stack just type:

```
stackathon
```

The first time you run it, Stackathon will ask for your API token(s) and check to make sure they are working. Stackathon will store your credentials so you won't have to enter them over and over again.

From there you can follow the instructions on the page and in minutes you will be ready to start hacking.

### What Does Stackathon Do?

Stackathon manages the dirty work of setting up a new server enviornment, it keeps track of stacks it creates and cleans up after itself when you delete a stack it created. Stackathon only needs a few pieces of information to get started and suggests sensible defaults: type of stack to build, admin username, admin password, SSH port, domain and sub-domain (or a project name).

When you create a new stack, Stackathon:

1. Generates a new set of SSH keys for your stack and stores them in the `~/.ssh` directory
2. Saves the public key for your stack in your [Digital Ocean SSH keys](https://cloud.digitalocean.com/settings/security)
3. Builds the flavor of Digital Ocean droplet your specify
4. Logs into your droplet and sets up a new superuser account with the username and password you supplied
5. Configures sshd on your droplet to use the port you specified, disables root login and allows your to login with your SSH keys
6. Sets the A record for your domain to the IP address of your droplet (optional)
5. Adds an entry to `~/.ssh/config` to allow you to SSH into your new stack with a single command

When you delete a stack, Stackathon:

1. Deletes your stack from Digital Ocean
2. Deletes the SSH key from Digital Ocean
3. Deletes the SSH keys stored in `~/.ssh`
4. Removed the IP address and key signiture for this stack from `~/.ssh/known_hosts` if present
5. Removes the entry from `~/.ssh/config`

### Setting DNS Records With Namecheap (optional)

Stackathon can automatically set the A record of a domain you have purchased from Namecheap to the IP address assigned to your new stack during deployment. To enable this functionality you will need to [request API access from Namecheap](https://manage.www.namecheap.com/myaccount/modify-profile-api.asp?APIACCESS.x=1&rkey=NC) in your account settings page.

It can take 24 hours for Namecheap to process your request and they may require that you have spent a certain amount of money with them. You can expidite a request by reaching out to their customer support team via [live chat](https://support.namecheap.com/livesupport.php) or [ticketing system](https://support.namecheap.com/).

### Security Note

Stackathon stores your API tokens and information about the stacks you have active in plain-text in a JSON file in your home directory `~/.stackathon`. You can purge your credentials from the JSON file by selecting the "Reset credentials" option from Stackathon's main menu. You can also invalidate your tokens from your Digital Ocean and Namecheap control panels if you accidently leave them on another computer.