from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
import mysql.connector
from mysql.connector import pooling
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

pool = pooling.MySQLConnectionPool(
    pool_name="mypool",
    pool_size=5,
    autocommit=True,
    host=os.getenv('MYSQL_HOST'),
    user=os.getenv('MYSQL_USER'),
    password=os.getenv('MYSQL_PASSWORD'),
    database=os.getenv('MYSQL_DB')
)

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
intentToEmail={}

@app.route('/webhook', methods=['POST'])
@cross_origin()
def stripeWebhook():
    payload = request.get_data(as_text=True)
    sig_header = request.headers.get('Stripe-Signature')

    try:
        # Verify the webhook signature to ensure it's from Stripe
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
        # Handle the event based on its type
        if event['type'] == 'payment_intent.succeeded':
            payment_intent = event['data']['object']  # Contains the payment intent
            payment_intent_id = payment_intent['id']
            order(intentToOrderItems[payment_intent_id], intentToAccessCode[payment_intent_id], payment_intent_id, intentToEmail[payment_intent_id])
            # You can now update your database or take appropriate action
        elif event['type'] == 'payment_intent.canceled':
            payment_intent = event['data']['object']  
            payment_intent_id = payment_intent['id']
            intentToOrderItems.pop(payment_intent_id)
            intentToAccessCode.pop(payment_intent_id)
            intentToEmail.pop(payment_intent_id)

        # Return a successful response to Stripe
        return "Webhook received and processed", 200

    except ValueError as e:
        # Invalid payload
        print("Invalid payload",flush=True)
        return "Invalid payload", 400

    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        print("Invalid signature",flush=True)
        return "Invalid signature", 400
    
def order(data,access_code,payment_reference,email):
    connection = pool.get_connection()
    cursor = connection.cursor(dictionary=True)
    table_id=getTableFromCode(access_code)
    cursor.execute('INSERT INTO FoodOrder(table_id,payment_reference,email) Values (%s,%s,%s)', (table_id,payment_reference,email,))
    order_id = cursor.lastrowid
    
    for i in data:
        menu_item_id = i.get("menu_item_id")
        quantity = i.get("quantity")
        special_instructions = i.get("special_instructions")

        cursor.execute('INSERT INTO OrderItem(order_id,menu_item_id,quantity,special_instructions,stat) VALUES (%s, %s, %s, %s, %s)', (order_id,menu_item_id,quantity,special_instructions,"TODO",))
    intentToOrderItems.pop(payment_reference)
    intentToAccessCode.pop(payment_reference)
    intentToEmail.pop(payment_reference)
    cursor.close()
    connection.close()

def getTableFromCode(code):
    connection = pool.get_connection()
    cursor = connection.cursor(dictionary=True)

    cursor.execute('SELECT table_id FROM FoodTable WHERE access_code = %s', (code,))
    tableId = cursor.fetchone()['table_id']

    cursor.close()
    connection.close()
    return tableId

def getPriceOfMenuItem(menu_item_id):
    connection = pool.get_connection()
    cursor = connection.cursor(dictionary=True)

    cursor.execute('SELECT price FROM MenuItem WHERE menu_item_id = %s', (menu_item_id,))
    price = cursor.fetchone()['price']

    cursor.close()
    connection.close()
    return price

@app.route("/createPaymentIntent", methods=["POST"])
@cross_origin()
def createPaymentIntent():
    try:
        amount = 0
        
        data = request.get_json()['cart']
        access_code = request.get_json()['table_number']
        email = request.get_json()['email']
        print(data,access_code,flush=True)
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
        intentToEmail[payment_intent.id]=email
        # Send back the client secret to the frontend
        return jsonify({
            'clientSecret': payment_intent.client_secret
        })

    except Exception as e:
        return jsonify(error=str(e)), 500

@app.route("/menu/", methods=["GET"])
@cross_origin()
def getMenu():
    connection = pool.get_connection()
    cursor = connection.cursor(dictionary=True)
    cursor.execute('SELECT * FROM MenuItem')  # Query the menu table
    menu_items = cursor.fetchall()
    cursor.close()
    connection.close()
    
    return jsonify(menu_items)

@app.route("/categories/", methods=["GET"])
@cross_origin()
def getCategories():
    connection = pool.get_connection()
    cursor = connection.cursor(dictionary=True)
    cursor.execute('SELECT DISTINCT category FROM MenuItem')  # Query the menu table
    categories = cursor.fetchall()
    cursor.close()
    connection.close()
    
    return jsonify(categories)

@app.route("/ingredients", methods=["GET"])
@cross_origin()
def getIngredients():
    menu_item_id = request.args.get("menu_item_id")    
    connection = pool.get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute('SELECT ingredient_name, quantity FROM Ingredient WHERE menu_item_id = %s', (menu_item_id,))
        ingredients = cursor.fetchall()
        return jsonify(ingredients)
    except Exception as err:
        return jsonify({"error": f"Database error: {err}"}), 500
    finally:
        cursor.close()
        connection.close()

@app.route("/menu/sorted/", methods=["GET"])
@cross_origin()
def getMenuSorted():
    connection = pool.get_connection()
    cursor = connection.cursor(dictionary=True)
    
    # Query the menu table and sort items by price in ascending order
    cursor.execute('SELECT * FROM MenuItem ORDER BY price ASC')
    sorted_menu_items = cursor.fetchall()
    cursor.close()
    connection.close()
    
    return jsonify(sorted_menu_items)

@app.route("/login", methods=["GET"])
@cross_origin()
def login():

    email = request.args.get("email")
    connection = pool.get_connection()
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
        connection.close()
    

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

    connection = pool.get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        # Insert the new customer 
        cursor.execute('INSERT INTO Customer(first_name,last_name,phone_number,email) VALUES (%s, %s, %s, %s)', (first_name,last_name,phone_number,email,))
    except Exception as err:
        return jsonify({"error": f"Database error: {err}"}), 500
    finally:
        cursor.close()
        connection.close()

    return jsonify({
        "message": "Customer created successfully"
    }), 201

@app.route("/kitchenQueue", methods=["GET"])
@cross_origin()
def kitchenQueue():

    connection = pool.get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute('SELECT order_id, table_id, menu_item_id, quantity, special_instructions, stat FROM OrderItem JOIN FoodOrder USING(order_id) WHERE stat != %s',('SERVED',))
        queue = cursor.fetchall()
        return jsonify(queue)
    except Exception as err:
        return jsonify({"error": f"Database error: {err}"}), 500
    finally:
        cursor.close()
        connection.close()

@app.route("/changeOrderStatus", methods=["POST"])
@cross_origin()
def changeOrderStat():
    
    data = request.get_json()

    order_id = data.get("order_id")
    menu_item_id = data.get("menu_item_id")
    stat = data.get("stat")

    connection = pool.get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute('UPDATE OrderItem SET stat = %s WHERE order_id = %s AND menu_item_id = %s',(stat,order_id,menu_item_id,))
        return jsonify({"message":f"order_id: {order_id}, menu_item_id: {menu_item_id} status updated"})
    except Exception as err:
        return jsonify({"error": f"Database error: {err}"}), 500
    finally:
        cursor.close()
        connection.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, threaded=True)