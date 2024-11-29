from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
import mysql.connector
import os
import stripe

app = Flask(__name__)
cors = CORS(app) # allow CORS for all domains on all routes.
app.config['CORS_HEADERS'] = 'Content-Type'

# Get MySQL credentials from environment variables
MYSQL_USER = os.getenv('MYSQL_USER')
MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD')
MYSQL_HOST = os.getenv('MYSQL_HOST')
MYSQL_DB = os.getenv('MYSQL_DB')

# Configure the MySQL connection
connection = mysql.connector.connect(
        host=os.getenv('MYSQL_HOST'),         # Use environment variable
        user=os.getenv('MYSQL_USER'),         # Use environment variable
        password=os.getenv('MYSQL_PASSWORD'), # Use environment variable
        database=os.getenv('MYSQL_DB')        # Use environment variable
    )
connection.autocommit = True

# Set your secret key
stripe.api_key = os.getenv('STRIPE_API_KEY')
endpoint_secret = os.getenv('ENDPOINT_SECRET')  # Secret for verifying webhook authenticity

intentToOrderItems={}
intentToAccessCode={}

@app.route('/webhook', methods=['POST'])
@cross_origin()
def stripe_webhook():
    payload = request.get_data(as_text=True)
    sig_header = request.headers.get('Stripe-Signature')

    try:
        # Verify the webhook signature to ensure it's from Stripe
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )

        # Handle the event based on its type
        if event['type'] == 'payment_intent.succeeded':
            # delete from database
            payment_intent = event['data']['object']  # Contains the canceled payment intent
            payment_intent_id = payment_intent['id']
            print(payment_intent_id,flush=True)
            order(intentToOrderItems[payment_intent_id],intentToAccessCode[payment_intent_id],payment_intent_id)
            # You can now update your database or take appropriate action
            # For example, set the order status to canceled
        elif event['type'] == 'payment_intent.canceled':
            payment_intent = event['data']['object']  
            payment_intent_id = payment_intent['id']
            intentToOrderItems.pop(payment_intent_id)
            intentToAccessCode.pop(payment_intent_id)


    except ValueError as e:
        # Invalid payload
        print("Invalid payload")

    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        print("Invalid signature")
    
def order(data,access_code,payment_reference):
    cursor = connection.cursor(dictionary=True)
    table_id=getTableFromCode(access_code)
    cursor.execute('INSERT INTO FoodOrder(table_id,payment_reference) Values (%d,%s)', (table_id,payment_reference,))
    order_id = cursor.lastrowid
    
    for i in data:
        menu_item_id = i.get("menu_item_id")
        quantity = i.get("quantity")
        special_instructions = i.get("special_instructions")
        email = i.get("email")

        cursor.execute('INSERT INTO OrderItem(email,order_id,menu_item_id,quantity,special_instructions,stat) VALUES (%s, %d, %d, %d, %s, %s)', (email,order_id,menu_item_id,quantity,special_instructions,"TODO",))
    intentToOrderItems.pop(payment_reference)
    intentToAccessCode.pop(payment_reference)
    cursor.close()

def getTableFromCode(code):

    cursor = connection.cursor(dictionary=True)

    cursor.execute('SELECT table_id FROM FoodTable WHERE access_code = %s', (code,))
    tableId = cursor.fetchone()['table_id']

    cursor.close()
    return tableId

def getPriceOfMenuItem(menu_item_id):

    cursor = connection.cursor(dictionary=True)

    cursor.execute('SELECT price FROM MenuItem WHERE menu_item_id = %s', (menu_item_id,))
    price = cursor.fetchone()['price']

    cursor.close()
    return price

@app.route("/createPaymentIntent", methods=["POST"])
@cross_origin()
def createPaymentIntent():
    cursor = connection.cursor(dictionary=True)
    try:
        amount = 0
        
        data = request.get_json()['cart']
        access_code = request.get_json()['table_number']
        print(data,flush=True)
        cursor = connection.cursor(dictionary=True)
        for i in data:
            menu_item_id = i.get("menu_item_id")
            quantity = i.get("quantity")
            amount+=quantity*getPriceOfMenuItem(menu_item_id)
            
        # Create a PaymentIntent with the amount and currency
        payment_intent = stripe.PaymentIntent.create(
            amount=int(amount*100),
            currency='usd'
        )

        intentToOrderItems[payment_intent.id]=data
        intentToAccessCode[payment_intent.id]=access_code
        # Send back the client secret to the frontend
        return jsonify({
            'clientSecret': payment_intent.client_secret
        })

    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        cursor.close()

@app.route("/menu/", methods=["GET"])
@cross_origin()
def getMenu():
    cursor = connection.cursor(dictionary=True)
    cursor.execute('SELECT * FROM MenuItem')  # Query the menu table
    menu_items = cursor.fetchall()
    cursor.close()
    
    return jsonify(menu_items)

@app.route("/categories/", methods=["GET"])
@cross_origin()
def getCategories():
    cursor = connection.cursor(dictionary=True)
    cursor.execute('SELECT DISTINCT category FROM MenuItem')  # Query the menu table
    categories = cursor.fetchall()
    cursor.close()
    
    return jsonify(categories)

@app.route("/ingredients", methods=["GET"])
@cross_origin()
def getIngredients():
    menu_item_id = request.args.get("menu_item_id")
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute('SELECT ingredient_name, quantity FROM Ingredient WHERE menu_item_id = %s', (menu_item_id,))
        ingredients = cursor.fetchall()
        return jsonify(ingredients)
    except Exception as err:
        return jsonify({"error": f"Database error: {err}"}), 500
    finally:
        cursor.close()

@app.route("/menu/sorted/", methods=["GET"])
@cross_origin()
def getMenuSorted():
    cursor = connection.cursor(dictionary=True)
    
    # Query the menu table and sort items by price in ascending order
    cursor.execute('SELECT * FROM MenuItem ORDER BY price ASC')
    sorted_menu_items = cursor.fetchall()
    cursor.close()
    
    return jsonify(sorted_menu_items)

@app.route("/login", methods=["GET"])
@cross_origin()
def login():

    email = request.args.get("email")
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute('SELECT COUNT(*) FROM Customer WHERE email = %s', (email,))
        count = cursor.fetchone()['COUNT(*)']

        if(count>0):
            return jsonify({
                "message": "Customer Exists"
            }), 201
        else:
            return jsonify({
                "message": "Customer Doesn't exist"
            }), 500
    except Exception as err:
        return jsonify({"error": f"Database error: {err}"}), 500
    finally:
        cursor.close()
    

@app.route("/createCustomer", methods=["POST"])
@cross_origin()
def createCustomer():
    # Get JSON data from the request body
    data = request.get_json()

    # Extract the fields from the JSON data
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    phone_number = data.get("phone_number")
    email = data.get("email")

    cursor = connection.cursor(dictionary=True)

    try:
        # Insert the new customer 
        cursor.execute('INSERT INTO Customer(first_name,last_name,phone_number,email) VALUES (%s, %s, %s, %s)', (first_name,last_name,phone_number,email,))
    except Exception as err:
        return jsonify({"error": f"Database error: {err}"}), 500
    finally:
        cursor.close()

    return jsonify({
        "message": "Customer created successfully"
    }), 201

@app.route("/kitchenQueue", methods=["GET"])
@cross_origin()
def kitchenQueue():

    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute('SELECT order_id, table_id, menu_item_id, quantity, special_instructions, stat FROM OrderItem JOIN FoodOrder USING(order_id) WHERE stat != %s',('SERVED',))
        queue = cursor.fetchall()
        return jsonify(queue)
    except Exception as err:
        return jsonify({"error": f"Database error: {err}"}), 500
    finally:
        cursor.close()

@app.route("/changeOrderStatus", methods=["POST"])
@cross_origin()
def changeOrderStat():
    
    data = request.get_json()

    order_id = data.get("order_id")
    menu_item_id = data.get("menu_item_id")
    stat = data.get("stat")

    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute('UPDATE OrderItem SET stat = %s WHERE order_id = %d AND menu_item_id = %d',(stat,order_id,menu_item_id,))
        return jsonify({"message":f"order_id: {order_id}, menu_item_id: {menu_item_id} status updated"})
    except Exception as err:
        return jsonify({"error": f"Database error: {err}"}), 500
    finally:
        cursor.close()

@app.route("/ingredients/<int:menu_item_id>", methods=["GET"])
@cross_origin()
def get_ingredients(menu_item_id):
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute('SELECT ingredient_name, quantity FROM Ingredient WHERE menu_item_id = %s', (menu_item_id,))
        ingredients = cursor.fetchall()
        cursor.close()
        return jsonify(ingredients)
    except Exception as err:
        cursor.close()
        return jsonify({"error": f"Database error: {err}"}), 500
    
@app.route("/categories", methods=["GET"])
@cross_origin()
def get_categories():
    cursor = connection.cursor(dictionary=True)
    try:
        # Query to get unique categories
        cursor.execute('SELECT DISTINCT category FROM MenuItem')
        categories = [row['category'] for row in cursor.fetchall()]
        return jsonify(categories)
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    finally:
        cursor.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
